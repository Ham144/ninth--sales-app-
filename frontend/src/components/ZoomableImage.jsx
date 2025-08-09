import { useState } from "react";

const ZoomableImage = ({ src }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <img
        src={src}
        alt="Preview"
        className="object-contain rounded-md mx-auto p-2 max-h-60 mt-4 cursor-pointer hover:scale-105 transition"
        onClick={() => setIsOpen(true)}
      />
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-80 flex items-center justify-center"
          onClick={() => setIsOpen(false)}
        >
          <img
            src={src}
            alt="Zoomed"
            className="max-h-[90vh] max-w-[90vw] object-contain border border-white rounded-lg"
          />
        </div>
      )}
    </>
  );
};

export default ZoomableImage;
