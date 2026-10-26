<?php

/*
 * omnidocs' Twig partials (the table of contents of a one-page manual, the search button), found where
 * Composer put the package - whatever its vendor name (omniscient/omnidocs, renamed omnisense/omnidocs).
 */

use Symfony\Component\DependencyInjection\Loader\Configurator\ContainerConfigurator;

return static function (ContainerConfigurator $container): void {
    $omnidocs = \dirname((string) (new ReflectionClass(Omnidocs\Registry::class))->getFileName());
    $container->extension('twig', ['paths' => [$omnidocs.'/Bridge/Twig/templates' => 'Omnidocs']]);
};
