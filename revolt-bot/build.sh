#!/bin/sh
apt-get update && apt-get install -yq libgconf-2-4 && npm install && npm run build
