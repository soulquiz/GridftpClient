#!/usr/bin/expect
set path1 [lindex $argv 0]
set path2 [lindex $argv 1]
eval spawn myproxy-logon -s myproxy.expresslane.com
expect "pass"
send "globus\r";
eval spawn globus-url-copy -cd -r $path1 $path2
interact

