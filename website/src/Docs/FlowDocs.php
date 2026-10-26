<?php

namespace App\Docs;

use Omnidocs\Jsdoc\JsdocSourceFactory;
use Omnidocs\Linking\RepositoryLinker;
use Omnidocs\Markdown\Changelog;
use Omnidocs\Markdown\MarkdownRenderer;
use Omnidocs\Markdown\MarkdownSourceFactory;
use Omnidocs\Model\Manual;
use Omnidocs\Model\Rendered;
use Omnidocs\Model\Version;
use Omnidocs\OnePage;
use Omnidocs\Registry;
use Omnidocs\Search\Entry;
use Omnidocs\Search\SearchIndex;
use Symfony\Component\DependencyInjection\Attribute\Autoconfigure;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;

/**
 * flowjs' documentation through omnidocs, read in the repository this site stands in, at the commit
 * built: the manual (the README, then docs/*.md in the order the README lists the modules) and the API
 * reference (what JSDoc explains of src/js), each one page; the changelog; the search index of all three.
 *
 * Public: static.php reads it from the container.
 */
#[Autoconfigure(public: true)]
class FlowDocs
{
    /** The modules, in the README's order. */
    public const MODULES = ['core', 'navigation', 'sticky', 'scenes', 'sortable', 'ajaxer', 'cookie', 'testing'];

    /** The API reference's groups, as the showcase's stations: a group's title => its globals. */
    public const API_GROUPS = [
        'Core' => ['Flow'],
        'Navigation' => ['Transparent', 'FlowFrame'],
        'Scrolling' => ['Sticky', 'StickyStops', 'StickyScenes'],
        'Lists' => ['StickySortable'],
        'Ajaxer' => ['Ajaxer'],
        'Cookie' => ['Cookie'],
    ];

    /** Each global's part of the manual and its demonstration on the showcase (anchors). */
    public const API_LINKS = [
        'Flow' => ['core', null],
        'Transparent' => ['navigation', 'navigation'],
        'FlowFrame' => ['navigation-a-website-in-the-website-flowframe-16', 'navigation'],
        'Sticky' => ['sticky', 'sticky'],
        'StickyStops' => ['sticky-scroll-stops', 'stops'],
        'StickyScenes' => ['scenes', 'scenes'],
        'StickySortable' => ['sortable', 'sortable'],
        'Ajaxer' => ['ajaxer', 'ajaxer'],
        'Cookie' => ['cookie', 'cookie'],
    ];

    private ?Registry $registry = null;

    private ?Changelog $changelog = null;

    /** @var array<string, OnePage> */
    private array $pages = [];

    public function __construct(
        private readonly UrlGeneratorInterface $urls,
        #[Autowire('%app.repository_dir%')] private readonly string $repositoryDir,
        #[Autowire('%app.repository%')] private readonly string $repository,
        #[Autowire('%app.branch%')] private readonly string $branch,
        #[Autowire('%app.commit%')] private readonly string $commit,
        #[Autowire('%app.jsdoc_file%')] private readonly string $jsdocFile,
        #[Autowire('%app.jsdoc_root%')] private readonly string $jsdocRoot,
    ) {
    }

    public function changelog(): Changelog
    {
        return $this->changelog ??= Changelog::read($this->repositoryDir.'/CHANGELOG.md', $this->renderer(), $this->linkRewriter($this->urls->generate('app_changelog')));
    }

    /** The manual, one page: the README, then each module's page. */
    public function manual(): OnePage
    {
        return $this->pages['manual'] ??= new OnePage($this->version('manual'), $this->links($this->urls->generate('app_docs')), $this->urls->generate('app_docs'));
    }

    /** The API reference, one page: a part per global the scripts set; null before bin/build ran JSDoc. */
    public function api(): ?OnePage
    {
        if (!is_file($this->jsdocFile)) {
            return null;
        }

        return $this->pages['api'] ??= new OnePage($this->version('api'), $this->links($this->urls->generate('app_api')), $this->urls->generate('app_api'), groups: true);
    }

    public function search(): SearchIndex
    {
        $index = (new SearchIndex())
            ->add(new Entry('page', 'Showcase', $this->urls->generate('app_home'), 'Flow running on this page: stops, sticky effects, navigation, sortable lists, AJAX channels, the cookie panel.', extra: 'demo'))
            ->onePage($this->manual(), 'Manual', 'page', 'manual', headingLevel: 4);
        if (null !== $api = $this->api()) {
            $index->onePage($api, 'API reference', 'page', 'api', headings: false);
        }
        $changelog = $this->urls->generate('app_changelog');
        foreach ($this->changelog()->releases() as $release) {
            $index->add(new Entry('release', 'Flow '.$release['version'], $changelog.'#'.$release['id'], '', extra: 'changelog '.($release['date'] ?? '')));
        }

        return $index;
    }

    public function renderer(): MarkdownRenderer
    {
        return new MarkdownRenderer(frames: true, inlineHtml: ['kbd'], versions: Changelog::read($this->repositoryDir.'/CHANGELOG.md')->knownVersions());
    }

    /** The changelog rendered, its links to the repository's files at the commit built. */
    public function changelogPage(): Rendered
    {
        return $this->changelog()->rendered;
    }

    private function version(string $name): Version
    {
        return new Version($this->branch, $this->registry()->get($name), $this->branch, $this->commit);
    }

    private function registry(): Registry
    {
        return $this->registry ??= new Registry([new MarkdownSourceFactory(), new JsdocSourceFactory()], [
            'manual' => ['factory' => 'markdown', 'options' => [
                'root' => $this->repositoryDir,
                'docs' => 'docs',
                'home' => 'README.md',
                'order' => self::MODULES,
                'inline_html' => ['kbd'],
                'versions' => Changelog::read($this->repositoryDir.'/CHANGELOG.md')->knownVersions(),
            ]],
            'api' => ['factory' => 'jsdoc', 'options' => [
                'file' => $this->jsdocFile,
                'root' => $this->jsdocRoot,
                'order' => ['Flow', 'Transparent', 'FlowFrame', 'Sticky', 'StickyStops', 'StickyScenes', 'StickySortable', 'Ajaxer', 'Cookie'],
                'groups' => self::API_GROUPS,
                'links' => $this->apiLinks(),
            ]],
        ]);
    }

    /** @return array<string, array<string, string>> a global => "Manual" and "Demo" => their addresses */
    private function apiLinks(): array
    {
        $docs = $this->urls->generate('app_docs');
        $home = $this->urls->generate('app_home');
        $links = [];
        foreach (self::API_LINKS as $global => [$manual, $demo]) {
            $links[$global] = ['Manual' => $docs.'#'.$manual] + (null !== $demo ? ['Demo' => $home.'#'.$demo] : []);
        }

        return $links;
    }

    /** GitHub at the commit built for the repository's files, the site's pages for the manual's. */
    private function links(string $url): RepositoryLinker
    {
        return new RepositoryLinker(static fn (string $path, ?string $fragment): string => $url.(null !== $fragment ? '#'.$fragment : ''), $this->repository, $this->commit);
    }

    /**
     * The changelog's links (it is one Markdown text, not a manual): a module's page to its part of
     * the manual, any other file of the repository to GitHub at the commit built.
     *
     * @return callable(string, bool): ?string
     */
    private function linkRewriter(string $url): callable
    {
        $docs = $this->urls->generate('app_docs');
        $links = $this->links($url);

        return static function (string $href, bool $image) use ($docs, $links): ?string {
            if ('' === $href || '#' === $href[0] || preg_match('#^[a-z][a-z0-9+.-]*:#i', $href)) {
                return null;
            }
            if (preg_match('#^docs/([a-z]+)\.md(?:\#(.*))?$#', $href, $m)) {
                return $docs.'#'.$m[1].(isset($m[2]) && '' !== $m[2] ? '-'.$m[2] : '');
            }

            return $image ? $links->image($href) : $links->file(ltrim($href, '/'));
        };
    }
}
