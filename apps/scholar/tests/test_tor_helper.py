import unittest
from unittest.mock import patch, MagicMock
from apps.scholar.scholarly.tor_helper import renew_tor_ip, get_tor_status
from apps.scholar.scholarly._proxy_generator import ProxyGenerator
from apps.scholar.scholarly.data_types import ProxyMode

class TestTorHelper(unittest.TestCase):
    @patch('socket.socket')
    def test_renew_tor_ip_success(self, mock_socket_cls):
        mock_socket = MagicMock()
        mock_socket_cls.return_value.__enter__.return_value = mock_socket
        mock_socket.recv.side_effect = [b"250 OK\r\n", b"250 OK\r\n"]

        res = renew_tor_ip(control_host='localhost', control_port=9051, password='test_pass', rebuild_wait=0)
        self.assertTrue(res)
        mock_socket.sendall.assert_any_call(b'AUTHENTICATE "test_pass"\r\n')
        mock_socket.sendall.assert_any_call(b'SIGNAL NEWNYM\r\n')

    @patch('socket.socket')
    def test_get_tor_status_online(self, mock_socket_cls):
        mock_socket = MagicMock()
        mock_socket_cls.return_value.__enter__.return_value = mock_socket
        mock_socket.recv.return_value = b"250 OK\r\n"

        status = get_tor_status(control_host='localhost', control_port=9051, password='test_pass')
        self.assertEqual(status.get("status"), "online")

    @patch.object(ProxyGenerator, '_new_session')
    def test_proxy_generator_tor(self, mock_new_session):
        pg = ProxyGenerator()
        res = pg.Tor(socks_host="tor", socks_port=9050)
        self.assertTrue(res)
        self.assertEqual(pg.proxy_mode, ProxyMode.TOR)
        mock_new_session.assert_called_with(proxies={"http": "socks5h://tor:9050", "https": "socks5h://tor:9050"})
