from http.server import HTTPServer, BaseHTTPRequestHandler 
import ssl
httpd = HTTPServer(('localhost', 8000), BaseHTTPRequestHandler)
httpd.socket = ssl.wrap_socket(
    httpd.socket,
    keyfile="certs/host.key",
    certfile='certs/host.cert',
    server_side=True)
httpd.serve_forever()
