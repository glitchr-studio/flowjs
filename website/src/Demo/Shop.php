<?php

namespace App\Demo;

/**
 * The website in the website: Kiln & Kettle, a small pottery shop that does not exist. Its pages are
 * pages of this site (/demo/frame/...), written for the frame of the showcase's Navigation station
 * (FlowFrame), and its pictures are drawings of this site (public/images/shop/*.svg).
 */
final class Shop
{
    public const NAME = 'Kiln & Kettle';

    /** The menu: page => its name. */
    public const MENU = ['home' => 'Home', 'shop' => 'Shop', 'journal' => 'Journal', 'about' => 'About', 'contact' => 'Contact'];

    /** The pages that are not an item's. */
    public const PAGES = ['home', 'shop', 'journal', 'about', 'contact', 'sent'];

    /** Former addresses of the demo (1.6.0's first site), sent to the shop's home. */
    public const FORMER = ['departure', 'line', 'terminus'];

    private const ITEMS = [
        'morning-mug' => ['name' => 'Morning mug', 'price' => 24, 'glaze' => 'Honey', 'text' => 'A wide mug that keeps both hands warm, thrown on the wheel and glazed in a honey tone that pools darker at the rim.'],
        'round-teapot' => ['name' => 'Round teapot', 'price' => 68, 'glaze' => 'Slate', 'text' => 'Holds four cups. The spout is cut so it never drips, the lid has a small notch so it stays on as you pour the last one.'],
        'rice-bowl' => ['name' => 'Rice bowl', 'price' => 18, 'glaze' => 'Celadon', 'text' => 'A small bowl with a tall foot, light in the hand. Celadon glaze, the clay left bare underneath.'],
        'bud-vase' => ['name' => 'Bud vase', 'price' => 32, 'glaze' => 'Rust', 'text' => 'One stem, maybe two. A narrow neck and a rust glaze that breaks to cream on the shoulders.'],
        'side-plate' => ['name' => 'Side plate', 'price' => 22, 'glaze' => 'Chalk', 'text' => 'Twenty centimetres, a soft chalk-white glaze, a rim turned up just enough to hold crumbs.'],
        'milk-jug' => ['name' => 'Milk jug', 'price' => 28, 'glaze' => 'Moss', 'text' => 'A jug for the table: a pulled lip that pours cleanly and a handle shaped by thumb.'],
    ];

    /** @return array<string, array{slug: string, name: string, price: int, glaze: string, text: string, image: string}> */
    public function items(): array
    {
        $items = [];
        foreach (self::ITEMS as $slug => $item) {
            $items[$slug] = $item + ['slug' => $slug, 'image' => 'images/shop/'.$slug.'.svg'];
        }

        return $items;
    }

    /** @return array{slug: string, name: string, price: int, glaze: string, text: string, image: string}|null */
    public function item(string $slug): ?array
    {
        return $this->items()[$slug] ?? null;
    }

    /** @return list<string> */
    public function slugs(): array
    {
        return array_keys(self::ITEMS);
    }
}
