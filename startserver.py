# startserver.py
# 
# A Python script to start a simple server in the 
# current directory and open a chrome page with localhost
#
# Copyright 2018 Erik Werner

# Uncomment one 
# MacOS
chrome_path = 'open -a /Applications/Google\ Chrome.app %s'
# Windows
# chrome_path = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe %s'
# Linux
# chrome_path = '/usr/bin/google-chrome %s'

# Define URL to open
HOST, PORT = "localhost", 8000
URL = 'http://localhost:8000/'

#!/usr/bin/env python
import webbrowser
import os 
import sys
from SocketServer import ThreadingMixIn, ForkingMixIn
from BaseHTTPServer import HTTPServer
from SimpleHTTPServer import SimpleHTTPRequestHandler

class ThreadingSimpleServer(ThreadingMixIn, HTTPServer):
    pass

class ForkingSimpleServer(ForkingMixIn, HTTPServer):
    pass
    
# Change to the directory of this file
dir_path = os.path.dirname(os.path.realpath(__file__))
os.chdir(dir_path)
dir_path = dir_path


server = ThreadingSimpleServer((HOST, PORT), SimpleHTTPRequestHandler)
# server = ForkingSimpleServer(('', port), SimpleHTTPRequestHandler)
addr, port = server.server_address
print("Current directory: %s" %(dir_path))
print("Serving HTTP on %s port %d ..." % (addr, port))

launchBrowser = True 

try:
    while 1:
        if launchBrowser:
            webbrowser.get(chrome_path).open(URL)
            launchBrowser = False
        sys.stdout.flush()
        server.handle_request()
except KeyboardInterrupt:
    print "Stopping HTTP Server..."
    sys.stdout.flush()