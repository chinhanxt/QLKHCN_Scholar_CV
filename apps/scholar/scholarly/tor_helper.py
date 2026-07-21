import socket
import time
import logging

logger = logging.getLogger(__name__)

def renew_tor_ip(control_host='tor', control_port=9051, password='scholar_secret_control_pass', rebuild_wait=8):
    """
    Sends NEWNYM signal to Tor ControlPort to switch exit node IP circuit.
    Requests to Google Scholar will be routed through 3 random Tor relays worldwide.
    """
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(10.0)
            s.connect((control_host, control_port))
            s.sendall(f'AUTHENTICATE "{password}"\r\n'.encode())
            response = s.recv(1024).decode()
            if "250 OK" in response:
                s.sendall(b'SIGNAL NEWNYM\r\n')
                response = s.recv(1024).decode()
                if "250 OK" in response:
                    logger.info("Tor IP changed successfully via NEWNYM signal.")
                    if rebuild_wait > 0:
                        time.sleep(rebuild_wait)
                    return True
                else:
                    logger.error(f"Tor NEWNYM rejected: {response}")
            else:
                logger.error(f"Tor Authentication failed: {response}")
    except Exception as e:
        logger.error(f"Failed to communicate with Tor ControlPort: {e}")
    return False

def get_tor_status(control_host='tor', control_port=9051, password='scholar_secret_control_pass'):
    """Checks if Tor control port is accessible and retrieves proxy info."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(5.0)
            s.connect((control_host, control_port))
            s.sendall(f'AUTHENTICATE "{password}"\r\n'.encode())
            response = s.recv(1024).decode()
            if "250 OK" in response:
                return {"status": "online", "control_port": control_port, "socks_port": 9050}
    except Exception as e:
        logger.warning(f"Tor status check failed: {e}")
    return {"status": "offline", "error": "Tor service disconnected"}
