# The website's build and its development server: PHP 8.4 with Composer, Node for JSDoc and Sass.
FROM php:8.4-cli-alpine
RUN apk add --no-cache git unzip curl nodejs npm
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
ENV COMPOSER_ALLOW_SUPERUSER=1 COMPOSER_CACHE_DIR=/tmp/composer-cache
WORKDIR /repo/website
