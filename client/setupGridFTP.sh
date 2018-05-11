#!/bin/bash

#Assign existing hostname to $hostn
hostn=$(cat /etc/hostname)

#Display existing hostname
echo "Existing hostname is $hostn"

#Ask for new hostname $newhost
echo "Enter new hostname: "
read newhost

#change hostname in /etc/hosts & /etc/hostname
sudo sed -i "s/$hostn/$newhost/g" /etc/hosts
sudo sed -i "s/$hostn/$newhost/g" /etc/hostname

#display new hostname
echo "Your new hostname is $newhost"

#trust the certificate authority
sudo myproxy-get-trustroots -b -s myproxy.expresslane.com

#retrieve your certificate from ca
yourdomain=$(echo $newhost| cut -d'.' -f 1)
sudo myproxy-retrieve -s myproxy.expresslane.com -k $newhost -l $yourdomain
#sudo myproxy-destroy -s myproxy.expresslane.com -k $newhost -l $yourdomain


#Press a key to reboot
read -s -n 1 -p "Press any key to reboot"
sudo reboot
