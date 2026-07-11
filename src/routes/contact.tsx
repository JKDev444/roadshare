import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";

import { SiteLayout } from "@/components/site/SiteLayout";
import { PageHero, Reveal, Section } from "@/components/site/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — RoadShare" },
      { name: "description", content: "Talk to the RoadShare team, request a demo, or ask about your community." },
      { property: "og:title", content: "Contact — RoadShare" },
      { property: "og:description", content: "Request a demo or ask about your community." },
    ],
  }),
  component: Contact,
});

function Contact() {
  const [sent, setSent] = useState(false);
  return (
    <SiteLayout>
      <PageHero
        eyebrow="Contact"
        title="Let's talk about your community."
        subtitle="Request a demo, ask a question, or tell us about your road group. We'll get back to you."
      />
      <Section>
        <div className="mx-auto max-w-xl">
          <Reveal>
            <form
              className="space-y-4 rounded-2xl border border-border bg-card p-6"
              onSubmit={(e) => {
                e.preventDefault();
                setSent(true);
                toast.success("Message sent", {
                  description: "This demo form doesn't send email yet — we'll wire it up in a later phase.",
                });
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" required className="mt-1.5" placeholder="Jane Rivera" />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required className="mt-1.5" placeholder="jane@example.com" />
                </div>
              </div>
              <div>
                <Label htmlFor="community">Community or role</Label>
                <Input id="community" className="mt-1.5" placeholder="Cedar Hollow road group" />
              </div>
              <div>
                <Label htmlFor="message">Message</Label>
                <Textarea id="message" required className="mt-1.5" rows={4} placeholder="How can we help?" />
              </div>
              <Button type="submit" className="w-full" disabled={sent}>
                <Mail className="mr-1.5 h-4 w-4" />
                {sent ? "Sent — thank you" : "Send message"}
              </Button>
            </form>
          </Reveal>
        </div>
      </Section>
    </SiteLayout>
  );
}
