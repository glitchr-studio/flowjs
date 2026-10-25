<?php

namespace App\Tests\Functional;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * The site as a visitor - and the static export - reads it: the repository's own docs/, README,
 * CHANGELOG and the JSDoc bin/build wrote (var/jsdoc.json; the API page is skipped without it).
 */
final class SiteTest extends WebTestCase
{
    public function testTheShowcaseRunsFlowBesideItsCode(): void
    {
        $client = static::createClient();
        $crawler = $client->request('GET', '/');

        self::assertResponseIsSuccessful();
        self::assertSelectorCount(8, 'section.sticky-stop', 'the page is a line of stops');
        foreach (['stops', 'navigation', 'sticky', 'sortable', 'ajaxer', 'cookie'] as $demo) {
            self::assertSelectorExists('#'.$demo.' .demo');
            self::assertSelectorExists('#'.$demo.' .demo-code .doc-code', $demo.': its code beside it');
        }
        self::assertSelectorExists('[data-stops-scroller] .sticky-stop.is-tall');
        self::assertSelectorExists('[data-sticky-axis="x"]');
        self::assertSelectorExists('[data-omnidocs-search="/search.json"]', 'the search, its index');
        self::assertSelectorExists('#page[data-layout="main"]', 'the block the navigation swaps');
        self::assertStringContainsString('ga-credits', (string) $client->getResponse()->getContent(), 'Glitch Art\'s signature');
        self::assertSame('/demo/ajaxer.json', $crawler->filter('[data-ajaxer-send]')->attr('data-ajaxer-url'));
    }

    public function testTheManualIsOnePageWithItsTableOfContents(): void
    {
        $client = static::createClient();
        $client->request('GET', '/docs/');
        $html = (string) $client->getResponse()->getContent();

        self::assertResponseIsSuccessful();
        foreach (['navigation', 'sticky', 'sortable', 'ajaxer', 'cookie'] as $module) {
            self::assertStringContainsString('class="doc-part" data-path="'.$module.'"', $html, $module.': a part of the one page');
        }
        self::assertSelectorExists('[data-omnidocs-toc] a[href="#sticky"]');
        self::assertStringContainsString('href="#sticky"', $html, 'the README\'s link to docs/sticky.md: its part');
        self::assertStringContainsString('data-version="1.1"', $html, 'a heading that says its version: a badge');
        self::assertStringContainsString('<kbd>↓</kbd>', $html);
        self::assertStringContainsString('href="https://github.com/glitchr-studio/flowjs/edit/master/docs/sticky.md"', $html, 'correct a part on GitHub');
    }

    public function testTheChangelogAndTheSearchIndex(): void
    {
        $client = static::createClient();
        $client->request('GET', '/changelog/');
        self::assertResponseIsSuccessful();
        self::assertSelectorExists('[data-omnidocs-toc] a[href^="#153"]');

        $client->request('GET', '/search.json');
        $index = json_decode((string) $client->getResponse()->getContent(), true, flags: \JSON_THROW_ON_ERROR);
        $kinds = array_count_values(array_column($index['entries'], 'k'));
        self::assertGreaterThan(10, $kinds['heading'] ?? 0);
        self::assertGreaterThan(5, $kinds['section'] ?? 0);
        self::assertGreaterThan(5, $kinds['release'] ?? 0);
        self::assertContains('/docs/#sticky', array_column($index['entries'], 'u'));
    }

    public function testTheApiReferenceFromJsdoc(): void
    {
        if (!is_file(\dirname(__DIR__, 2).'/var/jsdoc.json')) {
            self::markTestSkipped('bin/build assets writes var/jsdoc.json.');
        }
        $client = static::createClient();
        $client->request('GET', '/api/');
        $html = (string) $client->getResponse()->getContent();

        self::assertResponseIsSuccessful();
        foreach (['flow', 'transparent', 'sticky', 'stickystops', 'stickysortable', 'ajaxer', 'cookie'] as $global) {
            self::assertStringContainsString('id="'.$global.'" class="doc-part-title"', $html);
        }
        self::assertStringContainsString('id="stickystops-attach"', $html);
        self::assertStringContainsString('href="https://github.com/glitchr-studio/flowjs/blob/', $html, 'each entry links to its line');
        $client->request('GET', '/search.json');
        self::assertContains('StickyStops.attach', array_column(json_decode((string) $client->getResponse()->getContent(), true)['entries'], 't'));
    }

    public function testAnUnknownAddressIsTheSitesOwnPage(): void
    {
        $client = static::createClient();
        $client->request('GET', '/not-found');
        self::assertResponseStatusCodeSame(404);
        self::assertSelectorTextContains('h1', 'No station at this address');
    }
}
