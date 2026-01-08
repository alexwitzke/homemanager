#!/bin/bash

container="homemanager"

echo Stopping container
docker stop $container
docker rm homemanager

echo Cloning repository 
git clone https://github.com/alexwitzke/homemanager.git

cd homemanager/ 

echo Build container
docker build -t $container:latest .

echo Run container
docker run -d --name $container -v /mnt/user/appdata/homemanager:/app/config -p 3000:3000 $container:latest

echo Cleaning up
cd .. 
rm -rf $container