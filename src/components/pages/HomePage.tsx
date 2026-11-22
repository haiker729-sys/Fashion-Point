import React from 'react';
import { HeroSection } from '../home/HeroSection';
import { CategorySection } from '../home/CategorySection';
import { ShowroomPreview } from '../home/ShowroomPreview';
import { NewArrivals } from '../home/NewArrivals';
import { BestSellers } from '../home/BestSellers';
import { SeasonalBanner } from '../home/SeasonalBanner';
import { OffersSection } from '../home/OffersSection';
import { WhyChooseUs } from '../home/WhyChooseUs';
import { Testimonials } from '../home/Testimonials';
import { Newsletter } from '../home/Newsletter';

export const HomePage: React.FC = () => {
  return (
    <main className="fw-animate-fade">
      <HeroSection />
      <CategorySection />
      <ShowroomPreview />
      <NewArrivals />
      <BestSellers />
      <SeasonalBanner />
      <OffersSection />
      <WhyChooseUs />
      <Testimonials />
      <Newsletter />
    </main>
  );
};
