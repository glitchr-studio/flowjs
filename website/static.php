<?php

/*
 * The flowjs website's static export (omnibridge/static): every route of src/Controller rendered by the
 * site's own kernel as a visitor, for GitHub Pages.
 *
 *     bin/build export [--target=github-pages]
 *
 * SITE_URL: the public address - an origin, or the folder of one the site is served under
 * (https://glitchr-studio.github.io/flowjs/): the pages are rendered at the root and omnibridge/static
 * moves every internal address under the folder.
 */

use Omnibridge\Static\Render\RequestRenderer;
use Omnibridge\Static\Route\RouteCollectionProvider;
use Omnibridge\Static\Site;
use Symfony\Component\Dotenv\Dotenv;
use Symfony\Component\HttpFoundation\Request;

return static function (array $host): Site {
    $root = __DIR__;
    require_once $root.'/vendor/autoload.php';
    (new Dotenv())->bootEnv($root.'/.env');

    $static = rtrim(getenv('SITE_URL') ?: 'http://localhost:8683/flowjs/', '/');
    $origin = (new Site($static))->origin();

    $kernel = new App\Kernel($_SERVER['APP_ENV'], (bool) $_SERVER['APP_DEBUG']);
    $kernel->boot();
    $routes = $kernel->getContainer()->get('router')->getRouteCollection();

    return (new Site($static))
        ->provide(new RouteCollectionProvider($routes, exclude: ['app_not_found'], actions: ['App\Controller\\']))
        ->renderWith(new RequestRenderer(static fn (Request $request) => $kernel->handle($request), $origin))
        ->publicDir($root.'/public')
        // What the scripts fetch: the search index, the Ajaxer demo's answer - followed, and moved under the folder.
        ->resourceAttributes('data-omnidocs-search', 'data-ajaxer-url')
        ->notFound('/not-found')
        // The signature's render time and host: a static page was rendered once, at build time.
        ->normalise(static fn (string $html): string => (string) preg_replace('# <span class="ga-credits-time">\[[^\]]*\]</span>#', '', $html));
};
