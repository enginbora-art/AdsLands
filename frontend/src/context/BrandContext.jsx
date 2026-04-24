import { createContext, useContext, useState } from 'react';

const BrandContext = createContext(null);

export function BrandProvider({ children }) {
  const [selectedBrand, setSelectedBrand] = useState(null);
  return (
    <BrandContext.Provider value={{ selectedBrand, setSelectedBrand }}>
      {children}
    </BrandContext.Provider>
  );
}

export const useSelectedBrand = () => useContext(BrandContext);
