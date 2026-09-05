import type React from "react";

// Typed surface for the (@/components/ui/image).jsx Wix-Media image component.
// The .jsx ships an untyped forwardRef whose inferred props collapse to {},
// rejecting src/alt/fittingType/className at strict call sites. This co-located
// declaration is resolved ahead of the .jsx by the bundler module resolver, so
// importers get these props while Vite keeps bundling the .jsx for runtime.

export type ImageFittingType = "fill" | "fit";

export interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  fittingType?: ImageFittingType;
  originWidth?: number;
  originHeight?: number;
  focalPointX?: number;
  focalPointY?: number;
  quality?: number;
}

export declare const Image: React.ForwardRefExoticComponent<
  ImageProps & React.RefAttributes<HTMLImageElement>
>;