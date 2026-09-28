import socket
import ssl
import hashlib
import binascii
import logging
from typing import List, Dict, Optional, Tuple

logger = logging.getLogger("mikrotik_monitor")

class MikrotikApiError(Exception):
    pass

class MikrotikClient:
    def __init__(self, host: str, port: int = 8728, username: str = "admin", password: str = "", use_ssl: bool = False, timeout: float = 5.0):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.use_ssl = use_ssl
        self.timeout = timeout
        self.sock: Optional[socket.socket] = None
        self.connected = False

    def connect(self) -> bool:
        try:
            raw_sock = socket.create_connection((self.host, self.port), timeout=self.timeout)
            if self.use_ssl:
                context = ssl.create_default_context()
                context.check_hostname = False
                context.verify_mode = ssl.CERT_NONE
                self.sock = context.wrap_socket(raw_sock, server_hostname=self.host)
            else:
                self.sock = raw_sock

            self.connected = True
            return self._login()
        except Exception as e:
            logger.warning(f"Failed to connect to MikroTik at {self.host}:{self.port} - {e}")
            self.disconnect()
            return False

    def disconnect(self):
        self.connected = False
        if self.sock:
            try:
                self.sock.close()
            except Exception:
                pass
            self.sock = None

    def _write_word(self, word: str):
        b = word.encode('utf-8')
        length = len(b)
        if length < 0x80:
            len_bytes = bytes([length])
        elif length < 0x4000:
            len_bytes = bytes([(length >> 8) | 0x80, length & 0xFF])
        elif length < 0x200000:
            len_bytes = bytes([(length >> 16) | 0xC0, (length >> 8) & 0xFF, length & 0xFF])
        elif length < 0x10000000:
            len_bytes = bytes([(length >> 24) | 0xE0, (length >> 16) & 0xFF, (length >> 8) & 0xFF, length & 0xFF])
        else:
            raise MikrotikApiError("Word length too large")
        
        self.sock.sendall(len_bytes + b)

    def _write_sentence(self, sentence: List[str]):
        for word in sentence:
            self._write_word(word)
        self.sock.sendall(b'\x00')

    def _read_byte(self) -> int:
        b = self.sock.recv(1)
        if not b:
            raise MikrotikApiError("Socket connection closed by remote host")
        return b[0]

    def _read_length(self) -> int:
        b = self._read_byte()
        if (b & 0x80) == 0:
            return b
        elif (b & 0xC0) == 0x80:
            return ((b & ~0x80) << 8) | self._read_byte()
        elif (b & 0xE0) == 0xC0:
            return ((b & ~0xC0) << 16) | (self._read_byte() << 8) | self._read_byte()
        elif (b & 0xF0) == 0xE0:
            return ((b & ~0xE0) << 24) | (self._read_byte() << 16) | (self._read_byte() << 8) | self._read_byte()
        else:
            raise MikrotikApiError("Invalid length byte from MikroTik API")

    def _read_word(self) -> str:
        length = self._read_length()
        if length == 0:
            return ""
        buf = bytearray()
        while len(buf) < length:
            chunk = self.sock.recv(length - len(buf))
            if not chunk:
                raise MikrotikApiError("Unexpected EOF while reading RouterOS API word")
            buf.extend(chunk)
        return buf.decode('utf-8', errors='replace')

    def _read_sentence(self) -> Tuple[str, Dict[str, str]]:
        reply_type = self._read_word()
        params = {}
        while True:
            word = self._read_word()
            if not word:
                break
            if word.startswith('='):
                parts = word[1:].split('=', 1)
                if len(parts) == 2:
                    params[parts[0]] = parts[1]
                elif len(parts) == 1:
                    params[parts[0]] = ""
        return reply_type, params

    def talk(self, sentence: List[str]) -> List[Dict[str, str]]:
        if not self.connected or not self.sock:
            raise MikrotikApiError("Not connected to RouterOS API")
        
        self._write_sentence(sentence)
        results = []

        while True:
            reply_type, params = self._read_sentence()
            if reply_type == "!re":
                results.append(params)
            elif reply_type == "!done":
                if params:
                    results.append(params)
                break
            elif reply_type == "!trap":
                msg = params.get('message', 'Unknown trap error')
                raise MikrotikApiError(f"RouterOS API Trap: {msg}")
            elif reply_type == "!fatal":
                self.disconnect()
                raise MikrotikApiError("RouterOS API Fatal Connection Error")
        
        return results

    def _login(self) -> bool:
        try:
            # Modern RouterOS v6.43+ & v7 login
            reply = self.talk([
                "/login",
                f"=name={self.username}",
                f"=password={self.password}"
            ])
            return True
        except MikrotikApiError as e:
            # Check legacy challenge-MD5 login fallback
            try:
                res = self.talk(["/login"])
                if res and "ret" in res[0]:
                    challenge = binascii.unhexlify(res[0]["ret"])
                    md = hashlib.md5(b"\x00" + self.password.encode('utf-8') + challenge)
                    digest = binascii.hexlify(md.hexdigest().encode('utf-8')).decode('utf-8')
                    self.talk([
                        "/login",
                        f"=name={self.username}",
                        f"=response=00{digest}"
                    ])
                    return True
            except Exception as ex:
                logger.error(f"MikroTik login authentication failed: {ex}")
                self.disconnect()
                return False
            return False

    def get_interfaces(self) -> List[Dict[str, str]]:
        return self.talk([
            "/interface/print",
            "=.proplist=.id,name,running,disabled,rx-byte,tx-byte"
        ])
