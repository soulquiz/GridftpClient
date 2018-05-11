#!/bin/bash
echo "Add hostname and hostname's IP"
read -p 'Hostname: ' host_name
read -p 'IP: ' host_ip
echo "${host_ip}    ${host_name}" | sudo tee --append /etc/hosts > /dev/null
#printf "\n$host_ip   $host_name" >>  /etc/hosts
echo "Add $host_name and $host_ip already"
