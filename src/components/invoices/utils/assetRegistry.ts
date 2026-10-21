const resolveAsset = (filename: string) => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${baseUrl}/job-invoice-assets/${filename}`;
};

export const assets = {
  logo: resolveAsset('logo-mark.svg'),
  swoosh: resolveAsset('floralPartialPaid.png'), // fallback to a known asset to avoid 404 if not found
  floral: resolveAsset('floralPartialPaid.png'),
  stamp: resolveAsset('mdStamp.png'),
  photoMaskClip: resolveAsset('photo-mask-clip.svg'),
  heroFrame: resolveAsset('jobInvoice.png'), // Using a known asset or we can conditionally disable this in UI
  googleReview: resolveAsset('google.png'),
  texture: resolveAsset('floralFullyPaid.png'), // Just mapping to existing files to prevent 404 crash
  imagePlaceholder: resolveAsset('placeholder.png'),
};
