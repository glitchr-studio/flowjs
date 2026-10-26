<?php

namespace App\Demo;

/**
 * What the Ajaxer demo's channel answers: a name in the manner of generated project names ("Brave
 * Otter", "Quiet Comet"), one of 64 static files /demo/names/<n>.json written by the export. The
 * channel asks a random <n> each time, so each request is real and its answer different.
 */
final class Names
{
    public const COUNT = 64;

    private const ADJECTIVES = ['Brave', 'Quiet', 'Blue', 'Lucky', 'Gentle', 'Swift', 'Sunny', 'Curious', 'Mellow', 'Bright', 'Silver', 'Clever', 'Merry', 'Calm', 'Golden', 'Nimble'];

    private const NOUNS = ['Otter', 'Comet', 'Mouse', 'Teapot', 'Falcon', 'Lantern', 'Panda', 'Pebble', 'Heron', 'Kite', 'Badger', 'Meadow', 'Walrus', 'Compass', 'Fox', 'Acorn', 'Puffin', 'Harbor', 'Lynx', 'Canoe'];

    /** @return array{n: int, name: string, adjective: string, noun: string} */
    public function name(int $n): array
    {
        if ($n < 1 || $n > self::COUNT) {
            throw new \OutOfRangeException(\sprintf('A name is numbered 1 to %d, not %d.', self::COUNT, $n));
        }
        // Spread over the lists so that neighbours differ in both words: 64 distinct pairs.
        $adjective = self::ADJECTIVES[($n * 7) % \count(self::ADJECTIVES)];
        $noun = self::NOUNS[($n * 13 + intdiv($n, \count(self::ADJECTIVES))) % \count(self::NOUNS)];

        return ['n' => $n, 'name' => $adjective.' '.$noun, 'adjective' => $adjective, 'noun' => $noun];
    }

    /** @return list<int> */
    public function numbers(): array
    {
        return range(1, self::COUNT);
    }
}
