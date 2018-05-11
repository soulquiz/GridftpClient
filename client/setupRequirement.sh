#!/bin/bash
#sudo apt install --reinstall libappstream3
#or sudo apt-get purge libappstream3
sudo apt-get update
sudo apt-get install -y wget gcc sed make default-jre default-jdk openssl perl pkg-config apache2 elinks openssh-client openssh-server nmap expect curl xdotool
sudo wget -c https://downloads.globus.org/toolkit/gt6/stable/installers/repo/deb/globus-toolkit-repo_latest_all.deb 
sudo dpkg -i globus-toolkit-repo_latest_all.deb 
sudo apt-get update
sudo apt-get install -y globus-gridftp myproxy 
sudo apt autoremove
curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
sudo apt-get install -y nodejs
