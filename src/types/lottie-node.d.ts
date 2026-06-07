declare module 'lottie-node' {
   interface AnimationConfig {
      animationData: any;
      renderer: string;
      rendererSettings?: {
         context?: any;
      };
   }

   interface Animation {
      totalFrames: number;
      goToAndStop(frame: number, isFrame: boolean): void;
      destroy(): void;
   }

   function loadAnimation(config: AnimationConfig): Animation;
   export { loadAnimation };
}