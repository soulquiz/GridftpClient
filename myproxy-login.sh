#!/usr/bin/expect
eval spawn myproxy-logon -s myproxy.expresslane.com
expect "pass"
send "globus\r";
interact