import socket
import time
import logging

logger = logging.getLogger(__name__)

def renew_tor_ip(control_host='tor', control_port=9051, password='scholar_secret_control_pass', rebuild_wait=1.5):
    """
    Sends NEWNYM signal to Tor ControlPort on Docker container to switch exit node IP circuit.
    Requests to Google Scholar will be routed through 3 random Tor relays worldwide.
    """
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
