import React from 'react';
import { CheckCircle2, Quote } from 'lucide-react';
import { TESTIMONIALS } from '../../data/catalog';
import { RatingDisplay } from '../ui/Primitives';

export const Testimonials: React.FC = () => (
  <section
    aria-labelledby="testimonials-heading"
    className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20"
  >
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
      <div>
        <p className="text-xs font-semibold text-[#FF7A00]">Client Impressions</p>
        <h2
          id="testimonials-heading"
          className="mt-1 font-heading text-2xl sm:text-3xl font-semibold text-[#1F1D2B] tracking-tight"
        >
          Customer Reviews
        </h2>
        <p className="mt-1 text-sm text-[#1F1D2B]/65">
          Verified feedback from patrons across India wearing our tailored and traditional collections.
        </p>
      </div>
      <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#1F1D2B] tabular-nums">
        <RatingDisplay rating={4.9} reviewCount={6490} />
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {TESTIMONIALS.map((review) => (
        <article
          key={review.id}
          className="flex flex-col justify-between rounded-2xl border border-[#1F1D2B]/10 bg-white p-6 space-y-5 fw-card-hover"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <RatingDisplay rating={review.rating} />
              <Quote className="h-5 w-5 text-[#FFA94D]" aria-hidden="true" />
            </div>

            <p className="text-sm text-[#1F1D2B]/82 leading-relaxed">“{review.quote}”</p>
          </div>

          <div className="pt-4 border-t border-[#1F1D2B]/10 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-heading text-sm font-semibold text-[#1F1D2B]">{review.name}</p>
                <p className="text-xs text-[#1F1D2B]/55">
                  {review.role} · {review.city}
                </p>
              </div>
              <span className="text-[11px] text-[#1F1D2B]/45 tabular-nums">{review.date}</span>
            </div>
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[#16A34A]">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              Verified · {review.productPurchased}
            </p>
          </div>
        </article>
      ))}
    </div>
  </section>
);
