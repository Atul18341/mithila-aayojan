import React from 'react';

export const LinkedinIcon = ({ size = 24, strokeWidth = 2, className = "" }) => (
  <svg
    xmlns="http://w3.org"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="white"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* The Square Border */}
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect width="4" height="12" x="2" y="9" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);
export const InstagramIcon = ({ size = 24, strokeWidth = 2, className = "" }) => (
  <svg
    xmlns="http://w3.org"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Main Square Camera Body */}
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    {/* Center Lens Circle */}
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    {/* Small Flash Dot */}
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);
export const YoutubeIcon = ({ size = 24, strokeWidth = 2, className = "" }) => (
  <svg
    xmlns="http://w3.org"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Outer YouTube body with rounded corners */}
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
    {/* Inner "Play" triangle */}
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
  </svg>
);
export const WhatsappIcon = () => {
 return(
  <a 
      href="https://wa.me/91XXXXXXXXXX" 
      target="_blank" rel="noopener noreferrer"
      className="group relative flex items-center justify-center w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-600 transition-all duration-300 shadow-lg shadow-emerald-500/5"
    >
      <svg 
        viewBox="0 0 24 24" 
        className="w-6 h-6 transition-all duration-300"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Main Solid Bubble */}
        <path 
          className="fill-emerald-500 group-hover:fill-white transition-colors duration-300"
          d="M12.031 2c-5.511 0-9.997 4.486-9.997 9.998 0 1.762.459 3.418 1.261 4.864L2 22l5.286-1.388a9.929 9.929 0 004.745 1.198c5.512 0 9.998-4.486 9.998-9.998C22.029 6.486 17.543 2 12.031 2z" 
        />
        {/* Handset Knockout (Uses Footer BG: #020617) */}
        <path 
          className="fill-[#020617] group-hover:fill-emerald-700 transition-colors duration-300"
          d="M16.521 15.38c-.285-.143-1.688-.833-1.947-.928-.261-.094-.45-.142-.64.143-.189.285-.735.928-.901 1.117-.166.19-.333.214-.618.071a7.788 7.788 0 01-2.292-1.413c-.874-.778-1.464-1.74-1.635-2.025-.172-.285-.019-.439.124-.581.129-.127.285-.333.428-.5.143-.166.19-.285.285-.476.095-.19.048-.357-.024-.5-.071-.143-.64-1.543-.876-2.114-.231-.557-.463-.481-.64-.49l-.547-.008c-.19 0-.5.071-.762.357-.261.285-1 0.976-1 2.38 0 1.404 1.023 2.76 1.166 2.951.143.19 2.014 3.076 4.88 4.318.682.296 1.214.472 1.629.604.685.218 1.308.187 1.801.114.549-.082 1.688-.69 1.925-1.357.238-.666.238-1.238.167-1.357-.071-.12-.261-.189-.546-.332z" 
        />
      </svg>
    </a>

 );
}