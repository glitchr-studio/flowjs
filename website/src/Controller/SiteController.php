<?php

namespace App\Controller;

use App\Demo\Names;
use App\Demo\Shop;
use App\Docs\FlowDocs;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/**
 * The flowjs website: the showcase (flowjs running on the page, each demo beside its code), the
 * manual and the API reference (one page each, a sticky table of contents), the changelog, the
 * search index, and what the demos fetch. Every page is a file of the static export.
 */
final class SiteController extends AbstractController
{
    public function __construct(private readonly FlowDocs $docs)
    {
    }

    #[Route('/', name: 'app_home', methods: ['GET'])]
    public function home(Shop $shop): Response
    {
        $releases = $this->docs->changelog()->releases();

        return $this->render('site/home.html.twig', ['latest' => $releases[0] ?? null, 'shop' => $shop->items()]);
    }

    #[Route('/docs/', name: 'app_docs', methods: ['GET'])]
    public function manual(): Response
    {
        return $this->render('site/doc.html.twig', ['one' => $this->docs->manual(), 'kind' => 'manual', 'title' => 'Manual']);
    }

    #[Route('/api/', name: 'app_api', methods: ['GET'])]
    public function api(): Response
    {
        $api = $this->docs->api() ?? throw $this->createNotFoundException('The API reference is built from JSDoc\'s output: bin/build.');

        return $this->render('site/doc.html.twig', ['one' => $api, 'kind' => 'api', 'title' => 'API reference']);
    }

    #[Route('/changelog/', name: 'app_changelog', methods: ['GET'])]
    public function changelog(): Response
    {
        return $this->render('site/changelog.html.twig', ['changelog' => $this->docs->changelog()]);
    }

    /** The search index the palette downloads at the first search (omnidocs.js). */
    #[Route('/search.json', name: 'app_search_index', methods: ['GET'])]
    public function search(): JsonResponse
    {
        return JsonResponse::fromJsonString($this->docs->search()->toJson('en'));
    }

    /**
     * What the Ajaxer demo's channel asks for: a name, one of 64 static files (a static host answers
     * GET only), the channel picking one at random each time.
     */
    #[Route('/demo/names/{n}.json', name: 'app_demo_name', requirements: ['n' => '\d+'], methods: ['GET'])]
    public function name(int $n, Names $names): JsonResponse
    {
        try {
            return new JsonResponse($names->name($n) + ['channel' => 'names', 'of' => Names::COUNT]);
        } catch (\OutOfRangeException) {
            throw $this->createNotFoundException(\sprintf('Names are numbered 1 to %d.', Names::COUNT));
        }
    }

    /**
     * The website in the website (FlowFrame): Kiln & Kettle, a pottery shop that does not exist - pages
     * of this site, each with its [data-flow-frame-page] block, what the frame shows of them.
     */
    #[Route('/demo/frame/{page}/', name: 'app_demo_frame', requirements: ['page' => 'home|shop|journal|about|contact|sent'], methods: ['GET'])]
    public function frame(string $page, Shop $shop): Response
    {
        return $this->render('site/frame_page.html.twig', ['page' => $page, 'shop' => $shop->items(), 'item' => null]);
    }

    #[Route('/demo/frame/shop/{item}/', name: 'app_demo_frame_item', methods: ['GET'])]
    public function frameItem(string $item, Shop $shop): Response
    {
        $found = $shop->item($item) ?? throw $this->createNotFoundException('No such pot in the shop.');

        return $this->render('site/frame_page.html.twig', ['page' => 'item', 'shop' => $shop->items(), 'item' => $found]);
    }

    /** The frame's folder, and the demo's former pages (departure, line, terminus): the shop's home. */
    #[Route('/demo/frame/', name: 'app_demo_frame_index', methods: ['GET'])]
    #[Route('/demo/frame/{former}/', name: 'app_demo_frame_former', requirements: ['former' => 'departure|line|terminus'], methods: ['GET'])]
    public function frameIndex(): RedirectResponse
    {
        return $this->redirectToRoute('app_demo_frame', ['page' => 'home'], Response::HTTP_MOVED_PERMANENTLY);
    }

    /** The page for unknown addresses: 404.html in the export. */
    #[Route('/not-found', name: 'app_not_found', methods: ['GET'])]
    public function notFound(): Response
    {
        return $this->render('site/not_found.html.twig', [], new Response('', Response::HTTP_NOT_FOUND));
    }
}
