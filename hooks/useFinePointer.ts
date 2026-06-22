import * as React from 'react';

export function useFinePointer() {
  const [finePointer, setFinePointer] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia('(any-pointer: fine)');
    const onChange = () => {
      setFinePointer(mql.matches);
    };
    mql.addEventListener('change', onChange);
    setFinePointer(mql.matches);
    return () => {
      mql.removeEventListener('change', onChange);
    };
  }, []);

  return finePointer === true;
}
