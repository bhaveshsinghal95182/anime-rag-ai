type ArrowOutwardProps = {
  size?: number | string;
  className?: string;
};

const ArrowOutward = ({ size = 24, className = "" }: ArrowOutwardProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={className}
    aria-hidden="true"
  >
    <path fill="currentColor" d="M6.4 18L5 16.6L14.6 7H6V5h12v12h-2V8.4L6.4 18Z" />
  </svg>
);

export default ArrowOutward;
