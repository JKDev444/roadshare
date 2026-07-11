import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";

import { SiteLayout } from "@/components/site/SiteLayout";
import { CTASection, PageHero, Reveal, Section } from "@/components/site/primitives";
import { Button } from "@/components/ui/button";
import { PRODUCTS } from "@/lib/site/content";

export const Route = createFileRoute("/product/$slug")({
  loader: ({ params }) => {
    const product = PRODUCTS.find((p) => p.slug === params.slug);
    if (!product) throw notFound();
    return { product };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Product — RoadShare" }, { name: "robots", content: "noindex" }] };
    const { product } = loaderData;
    return {
      meta: [
        { title: `${product.name} — RoadShare` },
        { name: "description", content: product.summary },
        { property: "og:title", content: `${product.name} — RoadShare` },
        { property: "og:description", content: product.summary },
      ],
    };
  },
  component: ProductDetail,
  notFoundComponent: () => (
    <SiteLayout>
      <Section>
        <h1 className="font-display text-2xl font-bold">Product not found</h1>
        <p className="mt-2 text-muted-foreground">This product page doesn't exist.</p>
        <Button className="mt-4" asChild>
          <Link to="/product">Back to product</Link>
        </Button>
      </Section>
    </SiteLayout>
  ),
});

function ProductDetail() {
  const { product } = Route.useLoaderData();
  return (
    <SiteLayout>
      <PageHero
        eyebrow={product.eyebrow}
        title={product.tagline}
        subtitle={product.summary}
        primary={{ label: "Build a free scenario", to: "/tools/cedar-hollow" }}
        secondary={{ label: "Back to product", to: "/product" }}
      />
      <Section>
        <div className="grid gap-4 md:grid-cols-3">
          {product.features.map((f: { title: string; body: string }, i: number) => (
            <Reveal key={f.title} delay={i * 0.05}>
              <div className="h-full rounded-2xl border border-border bg-card p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Check className="h-5 w-5" />
                </span>
                <h2 className="mt-4 font-display text-lg font-semibold">{f.title}</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-10">
          <Link to="/product" className="inline-flex items-center text-sm font-medium text-primary">
            Explore all products <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Reveal>
      </Section>
      <CTASection />
    </SiteLayout>
  );
}
