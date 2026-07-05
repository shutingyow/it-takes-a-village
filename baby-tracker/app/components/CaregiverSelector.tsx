"use client";

import { useEffect, useState } from "react";

interface CaregiverSelectorProps {
  caregivers: string[];
  value: string;
  onChange: (caregiver: string) => void;
}

export function CaregiverSelector({
  caregivers,
  value,
  onChange,
}: CaregiverSelectorProps) {
  useEffect(() => {
    // Load saved caregiver from localStorage
    const saved = localStorage.getItem("selectedCaregiver");
    if (saved && caregivers.includes(saved)) {
      onChange(saved);
    } else if (caregivers.length > 0 && !value) {
      onChange(caregivers[0]);
    }
  }, [caregivers]);

  const handleChange = (newValue: string) => {
    onChange(newValue);
    localStorage.setItem("selectedCaregiver", newValue);
  };

  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-white border-b">
      <span className="text-sm text-gray-600">👤 Logged in as:</span>
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        className="flex-1 text-sm font-medium text-gray-900 bg-transparent border-0 focus:ring-0 cursor-pointer"
      >
        {caregivers.map((caregiver) => (
          <option key={caregiver} value={caregiver}>
            {caregiver}
          </option>
        ))}
      </select>
    </div>
  );
}
