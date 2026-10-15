"use client";
import { AlertCircle, AtSign, Star } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { submitFeedbackAction } from "../../actions";

export function FeedbackForm({
  token,
  firstName,
  googleReviewUrl,
  instagramHandle,
}: {
  token: string;
  firstName: string | null;
  googleReviewUrl: string | null;
  instagramHandle: string | null;
}) {
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (result !== null) {
    if (result === 5) {
      return (
        <div className="flex flex-col items-start gap-4">
          <h1 className="text-heading font-semibold">Thank you! Would you share it?</h1>
          <p className="text-fg-2">A review or a tag helps other people find us.</p>
          <div className="flex w-full flex-col gap-3 sm:flex-row">
            {googleReviewUrl && (
              <a href={googleReviewUrl} className="tap inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-md bg-accent px-5 font-semibold text-on-accent">
                <Star className="size-4" aria-hidden /> Google review
              </a>
            )}
            <a
              href={`https://instagram.com/${instagramHandle ?? "drink"}`}
              className="tap inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-md border border-line-strong bg-surface px-5 font-semibold"
            >
              <AtSign className="size-4" aria-hidden /> Tag @{instagramHandle ?? "drink"}
            </a>
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-start gap-3">
        <h1 className="text-heading font-semibold">{result <= 3 ? "Thanks for being honest." : "Thanks for the feedback."}</h1>
        <p className="text-fg-2">{result <= 3 ? "Clint will reach out." : "See you for the next one."}</p>
      </div>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) return setError("Tap a number from 1 to 5.");
    setError(null);
    start(async () => {
      const r = await submitFeedbackAction({ token, rating, comment: comment.trim() || undefined });
      if (r.ok) setResult(r.rating ?? rating);
      else setError(r.message);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <div>
        <h1 className="text-heading font-semibold">How did it go{firstName ? `, ${firstName}` : ""}?</h1>
        <p className="mt-1 text-fg-2">1 = not happy, 5 = loved it.</p>
      </div>
      <div role="radiogroup" aria-label="Rating from 1 to 5" className="flex justify-between gap-2 sm:justify-start sm:gap-4">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} out of 5`}
            onClick={() => setRating(n)}
            className={cn(
              "tap flex size-12 items-center justify-center rounded-full border text-subhead font-semibold tabular transition-colors duration-150",
              rating === n ? "border-fg bg-fg text-bg" : "border-line-strong bg-surface hover:bg-hover",
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <Textarea label="Anything to add?" optional rows={4} value={comment} onChange={(e) => setComment(e.target.value)} />
      {error && (
        <p className="flex items-start gap-2 text-label text-accent-fg" role="alert">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
        </p>
      )}
      <Button type="submit" variant="primary" block loading={pending}>
        Send feedback
      </Button>
    </form>
  );
}
