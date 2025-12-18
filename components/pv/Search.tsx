import React, { SetStateAction } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from '@/components/ui/button';
import { SearchIcon } from 'lucide-react';


interface SearchProps {
    query: string;
    setQuery: React.Dispatch<SetStateAction<string>>;
    handleSearch: () => void;
}

const Search: React.FC<SearchProps> = ({ query, setQuery, handleSearch }) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <div className='flex w-full gap-4 place-items-center'>
        <Input
            placeholder="Search . . ."
            onKeyDown={handleKeyDown}
            defaultValue={query}
            onChange={(e) => setQuery(e.target.value)}
        />
        <Button onClick={handleSearch}><SearchIcon /> Search</Button>
    </div>
  )
}

export default Search