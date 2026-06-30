#!/bin/sh
set -e
# Inject WAHA API key into nginx config at runtime
sed -i "s|__WAHA_API_KEY__|${WAHA_API_KEY:-}|g" /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
