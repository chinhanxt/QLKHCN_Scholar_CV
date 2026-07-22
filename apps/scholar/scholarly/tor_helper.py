import socket
import time
import logging

try:
    from django.conf import settings
except ImportError:
    settings = None

logger = logging.getLogger(__name__)

def _get_setting(name, default):
    if settings is not None:
        return getattr(settings, name, default)
    return default

def renew_tor_ip(control_host=None, control_port=None, password=None, rebuild_wait=1.5):
    """
    Sends NEWNYM signal to Tor ControlPort on Docker container to switch exit node IP circuit.
    Requests to Google Scholar will be routed through 3 random Tor relays worldwide.
    """
    if control_host is None:
        control_host = _get_setting('TOR_CONTROL_HOST', 'tor')
    if control_port is None:
        control_port = int(_get_setting('TOR_CONTROL_PORT', 9051))
    if password is None:
        password = _get_setting('TOR_PASSWORD', 'scholar_secret_control_pass')
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(5.0)
            s.connect((control_host, control_port))
            s.sendall(f'AUTHENTICATE "{password}"\r\n'.encode())
            response = s.recv(1024).decode()
            if "250 OK" in response:
                s.sendall(b'SIGNAL NEWNYM\r\n')
                response = s.recv(1024).decode()
                if "250 OK" in response:
                    logger.info(f"Tor IP changed successfully via NEWNYM signal on Docker container {control_host}:{control_port}.")
                    if rebuild_wait > 0:
                        time.sleep(rebuild_wait)
                    return True
                else:
                    logger.error(f"Tor NEWNYM rejected: {response}")
            else:
                logger.error(f"Tor Authentication failed: {response}")
    except Exception as e:
        logger.error(f"Failed to communicate with Docker Tor ControlPort on {control_host}:{control_port}: {e}")
    return False

def get_tor_status(control_host='tor', control_port=9051, password='scholar_secret_control_pass'):
    """Checks if Docker Tor control port is accessible and retrieves proxy info."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(3.0)
            s.connect((control_host, control_port))
            s.sendall(f'AUTHENTICATE "{password}"\r\n'.encode())
            response = s.recv(1024).decode()
            if "250 OK" in response:
                return {"status": "online", "control_port": control_port, "socks_port": 9050, "host": control_host}
    except Exception as e:
        logger.debug(f"Docker Tor status check failed on {control_host}: {e}")
    return {"status": "offline", "error": "Tor service container disconnected"}


def setup_tor_proxy_with_fallback(socks_host='tor', socks_port=9050):
    """
    Configures scholarly to strictly use Docker Tor SOCKS5 Proxy Gateway (tor:9050).
    """
    from apps.scholar.scholarly import scholarly, ProxyGenerator
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(3.0)
            s.connect((socks_host, socks_port))
        # Socket connected! Configure ProxyGenerator
        pg = ProxyGenerator()
        pg.Tor(socks_host=socks_host, socks_port=socks_port)
        scholarly.use_proxy(pg)
        logger.info(f"Successfully connected scholarly via Docker Tor SOCKS5 proxy on {socks_host}:{socks_port}")
        return True
    except Exception as e:
        logger.error(f"Docker Tor SOCKS5 proxy connection failed on {socks_host}:{socks_port}: {e}")

    return False


def get_tor_proxies(socks_host=None, socks_port=None):
    """
    Returns proxy dictionary for requests library using Tor SOCKS5 (socks5h).
    Tries connecting to socks_host:socks_port, falls back to 127.0.0.1:socks_port.
    """
    if socks_host is None:
        socks_host = _get_setting('TOR_SOCKS_HOST', 'tor')
    if socks_port is None:
        socks_port = int(_get_setting('TOR_SOCKS_PORT', 9050))
    for host in [socks_host, '127.0.0.1', 'localhost']:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(1.5)
                s.connect((host, socks_port))
            proxy_url = f"socks5h://{host}:{socks_port}"
            return {'http': proxy_url, 'https': proxy_url}
        except Exception:
            continue
    return None

