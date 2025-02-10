# Use the official lightweight Nginx image
FROM nginx:alpine

# Copy our static files to the Nginx html directory
COPY index.html /usr/share/nginx/html/index.html

# Copy the custom Nginx configuration file to override the default configuration
COPY default.conf /etc/nginx/conf.d/default.conf

# Expose port 80 to the Docker network and optionally to the host
EXPOSE 80
