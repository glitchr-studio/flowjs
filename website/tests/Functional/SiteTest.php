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
        self::assertSelectorCount(7, 'section.sticky-stop', 'the page is a line of stations: the top, five stations, the start');
        self::assertSelectorCount(5, '.line li', 'five stations on the line');
        foreach (['navigation', 'scrolling', 'sortable', 'ajaxer', 'cookie'] as $station) {
            self::assertSelectorExists('section#'.$station, $station.': a station of its own');
            self::assertSelectorExists('.line a[href="#'.$station.'"]', $station.': on the line map');
        }
        self::assertSelectorTextContains('.line a[href="#scrolling"] small', 'Sticky · StickyStops · StickyScenes');
        foreach (['sticky', 'stops', 'scenes'] as $panel) {
            self::assertSelectorExists('section#scrolling .panel#'.$panel, $panel.': a panel of the Scrolling station (its former anchor)');
            self::assertSelectorExists('.panel-tabs a[href="#'.$panel.'"]');
        }
        foreach (['ajaxer', 'cookie'] as $demo) {
            self::assertSelectorExists('#'.$demo.' .demo-code .doc-code', $demo.': its code beside it');
        }
        self::assertSelectorExists('#sticky .demo-code .doc-code');
        self::assertSelectorExists('#stops .demo-code .doc-code');
        self::assertSelectorExists('#sortable .doc-code');

        // Navigation: the website in the website first, then the counter and the bar.
        self::assertSelectorExists('#navigation .demo-card.is-flagship [data-flow-frame="tour"] [data-flow-frame-view] [data-flow-frame-page] .kk.is-home', 'the framed browser shows the shop\'s home');
        self::assertSelectorCount(3, '#navigation .browser-bar .browser-icon svg', 'back, forward and reload: icons');
        self::assertSelectorExists('#navigation [data-frame-pages]');
        self::assertSelectorCount(2, '#navigation .feature-grid .demo-card');
        self::assertSelectorExists('[data-bar-look="rainbow"]');

        // Scrolling: the scene read sideways, its track of three panels, its hint.
        self::assertSelectorExists('#scenes .sticky-scene[data-scene-axis="x"] .sticky-scene-stage .laptop', 'the scene: a device on its stage');
        self::assertSelectorCount(3, '#scenes [data-scene-track] [data-scene-panel] .scene-card');
        self::assertSelectorExists('#scenes [data-scene-hint]');
        self::assertSelectorExists('[data-stops-scroller] .sticky-stop.is-tall');
        self::assertSelectorExists('[data-sticky-axis="x"]');

        // Sortable: a list and a tree (a leaf among its chapters).
        self::assertSelectorExists('[data-sortable-list] [data-sortable-item] .grip');
        self::assertSelectorExists('[data-sortable-tree] > li[data-sortable-item] > ol > li[data-sortable-item][data-id="install"]');
        self::assertSelectorExists('[data-sortable-tree] > li[data-sortable-leaf]');
        self::assertSelectorExists('[data-sortable-tree-out]');

        // Ajaxer: a name, its history, the response folded.
        self::assertSame('/demo/names/1.json', $crawler->filter('[data-ajaxer-send]')->attr('data-ajaxer-url'));
        self::assertSelectorExists('[data-ajaxer-name]');
        self::assertSelectorExists('[data-ajaxer-history]');
        self::assertSelectorTextContains('#ajaxer details summary', 'See the response');

        // Cookie: two buttons (the corner, the station), each with its place for the panel.
        self::assertSelectorCount(2, '[data-fc] [data-fc-toggle]');
        self::assertSelectorExists('.fc.is-corner [data-cookie-banner] [data-cookie-details] template[data-cookie-row]');
        self::assertSelectorExists('#cookie .fc.is-section [data-cookie-banner] [data-cookie-countdown] [data-cookie-count]');
        self::assertSelectorExists('#cookie [data-cookie-demo-first]');
        self::assertSelectorExists('#cookie [data-cookie-demo-countdown]');
        self::assertSelectorExists('#cookie [data-cookie-demo-dot]');

        self::assertSelectorExists('[data-omnidocs-search="/search.json"]', 'the search, its index');
        self::assertSelectorExists('#page[data-layout="main"]', 'the block the navigation swaps');
        self::assertStringContainsString('ga-credits', (string) $client->getResponse()->getContent(), 'Glitch Art\'s signature');
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

        // The index: a card per global, by the showcase's groups, each with what it holds and its links.
        $crawler = $client->getCrawler();
        self::assertSame(['Core', 'Navigation', 'Scrolling', 'Lists', 'Ajaxer', 'Cookie'], $crawler->filter('.api-index .api-group-title')->each(static fn ($n): string => $n->text()));
        self::assertCount(9, $crawler->filter('.api-index .api-card'));
        self::assertMatchesRegularExpression('#\d+ options · \d+ methods · 2 events#', $crawler->filter('.api-card[data-global="StickyScenes"] .api-card-counts')->text());
        self::assertStringContainsString('scenes the scroll plays', $crawler->filter('.api-card[data-global="StickyScenes"] .api-card-about')->text(), 'its file\'s @file comment');
        self::assertStringContainsString('id="stickyscenes-event-scene-progress"', $html, 'an event documented on its global');
        // The table of contents by group: Navigation, Scrolling... as disclosures.
        self::assertSelectorExists('[data-omnidocs-toc] .omnidocs-toc-entry.is-group [data-omnidocs-toc-disclose][aria-controls="omnidocs-toc-group-scrolling"]');
        self::assertSelectorExists('#omnidocs-toc-group-scrolling a[href="#stickyscenes"]');
        self::assertSelectorExists('.prose .doc-group#group-scrolling');
        // Every link of a card leads somewhere: its part of the manual, its demonstration.
        $manual = (string) $client->request('GET', '/docs/')->html();
        $home = (string) $client->request('GET', '/')->html();
        foreach ($crawler->filter('.api-card-links a')->each(static fn ($a): string => (string) $a->attr('href')) as $href) {
            [$page, $anchor] = explode('#', $href);
            self::assertStringContainsString('id="'.$anchor.'"', '/docs/' === $page ? $manual : $home, $href.': an anchor of its page');
        }
        self::assertStringContainsString('href="https://github.com/glitchr-studio/flowjs/blob/', $html, 'each entry links to its line');
        $client->request('GET', '/search.json');
        self::assertContains('StickyStops.attach', array_column(json_decode((string) $client->getResponse()->getContent(), true)['entries'], 't'));
    }

    public function testTheFramesPagesAreTheShopsPagesWithTheirBlock(): void
    {
        $client = static::createClient();
        foreach (['home', 'shop', 'journal', 'about', 'contact', 'sent'] as $page) {
            $client->request('GET', '/demo/frame/'.$page.'/');
            self::assertResponseIsSuccessful();
            self::assertSelectorExists('[data-flow-frame-page] .kk.is-'.$page);
            self::assertSelectorCount(5, '[data-flow-frame-page] .kk-menu a', $page.': the shop\'s menu');
        }
        $crawler = $client->request('GET', '/demo/frame/shop/');
        self::assertCount(6, $crawler->filter('.kk-grid li a[href^="/demo/frame/shop/"]'), 'the shop lists its six pieces');
        $client->request('GET', '/demo/frame/shop/round-teapot/');
        self::assertResponseIsSuccessful();
        self::assertSelectorTextContains('.kk-item h1', 'Round teapot');
        self::assertSelectorExists('.kk-item img[src$="images/shop/round-teapot.svg"]');
        $client->request('GET', '/demo/frame/shop/no-such-pot/');
        self::assertResponseStatusCodeSame(404);
        $client->request('GET', '/demo/frame/contact/');
        self::assertSelectorExists('form.kk-form[action="/demo/frame/sent/"][method="get"]');

        $client->request('GET', '/demo/frame/');
        self::assertResponseRedirects('/demo/frame/home/', 301, 'the frame\'s folder: its home');
        $client->request('GET', '/demo/frame/departure/');
        self::assertResponseRedirects('/demo/frame/home/', 301, 'a former page of the demo: the home');
    }

    public function testTheNamesTheAjaxerChannelAsksFor(): void
    {
        $client = static::createClient();
        $names = [];
        foreach (range(1, 64) as $n) {
            $client->request('GET', '/demo/names/'.$n.'.json');
            self::assertResponseIsSuccessful();
            $name = json_decode((string) $client->getResponse()->getContent(), true, flags: \JSON_THROW_ON_ERROR);
            self::assertSame($n, $name['n']);
            self::assertMatchesRegularExpression('/^[A-Z][a-z]+ [A-Z][a-z]+$/', $name['name']);
            $names[] = $name['name'];
        }
        self::assertCount(64, array_unique($names), '64 different names');
        $client->request('GET', '/demo/names/65.json');
        self::assertResponseStatusCodeSame(404);
    }

    public function testAnUnknownAddressIsTheSitesOwnPage(): void
    {
        $client = static::createClient();
        $client->request('GET', '/not-found');
        self::assertResponseStatusCodeSame(404);
        self::assertSelectorTextContains('h1', 'No station at this address');
    }
}
