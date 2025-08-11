export default function Logo() {
    return (
      <img
        src="/logo.svg"
        alt="KickClips Logo"
        className="
          w-10 h-10          /* mobile */
          sm:w-12 sm:h-12    /* small screens */
          md:w-16 md:h-16    /* tablets+ */
          lg:w-20 lg:h-20    /* desktop */
          object-contain
        "
      />
    );
  }
  