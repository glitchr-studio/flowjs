<?php

namespace App\Site;

use Symfony\Component\DependencyInjection\Attribute\Autowire;

/** Who the site is: its name, its repository, the commit it is built at, its public address (the Twig global `site`). */
final class Identity
{
    public function __construct(
        #[Autowire('%app.repository%')] public readonly string $repository,
        #[Autowire('%app.branch%')] public readonly string $branch,
        #[Autowire('%app.commit%')] public readonly string $commit,
        #[Autowire('%app.site_url%')] private readonly string $url,
    ) {
    }

    public function name(): string
    {
        return 'Flow';
    }

    public function githubUrl(): string
    {
        return 'https://github.com/'.$this->repository;
    }

    public function npmUrl(): string
    {
        return 'https://www.npmjs.com/package/@glitchr/flowjs';
    }

    /** The commit, short. */
    public function shortCommit(): string
    {
        return substr($this->commit, 0, 7);
    }

    /** An absolute address at the static site's public origin (canonical links). */
    public function absolute(string $path): string
    {
        $parts = parse_url($this->url) ?: [];
        $origin = ($parts['scheme'] ?? 'http').'://'.($parts['host'] ?? 'localhost').(isset($parts['port']) ? ':'.$parts['port'] : '');

        return $origin.$path;
    }
}
