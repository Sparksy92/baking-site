'use client';

import Image from 'next/image';

export default function HomesteadBackground() {
  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-black select-none pointer-events-none">
      <Image
        src="/bakery_hearth.jpg"
        alt="Cozy Bakery Hearth Background"
        fill
        sizes="100vw"
        priority
        className="object-cover object-center brightness-[0.85]"
      />
    </div>
  );
}
