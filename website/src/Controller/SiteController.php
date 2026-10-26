<?php

namespace App\Controller;

use App\Docs\FlowDocs;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
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
    public function home(): Response
    {
        $releases = $this->docs->changelog()->releases();

        return $this->render('site/home.html.twig', ['latest' => $releases[0] ?? null]);
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

    /** What the Ajaxer demo asks for: a static host answers GET only. */
    #[Route('/demo/ajaxer.json', name: 'app_demo_ajaxer', methods: ['GET'])]
    public function ajaxer(): JsonResponse
    {
        return new JsonResponse(['module' => 'Ajaxer', 'channel' => 'demo', 'message' => 'Answered by a static file: GET, throttled, its loader shown while it travels.']);
    }

    /**
     * The pages the website-in-website demo browses inside its frame (FlowFrame): pages of the site,
     * each with its [data-flow-frame-page] block - what the frame shows of them.
     */
    #[Route('/demo/frame/{page}/', name: 'app_demo_frame', requirements: ['page' => 'departure|line|terminus'], methods: ['GET'])]
    public function frame(string $page): Response
    {
        return $this->render('site/frame_page.html.twig', ['page' => $page]);
    }

    /** The page for unknown addresses: 404.html in the export. */
    #[Route('/not-found', name: 'app_not_found', methods: ['GET'])]
    public function notFound(): Response
    {
        return $this->render('site/not_found.html.twig', [], new Response('', Response::HTTP_NOT_FOUND));
    }
}
