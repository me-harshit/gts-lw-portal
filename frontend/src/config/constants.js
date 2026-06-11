const isProduction = window.location.hostname !== 'localhost';

export const API_URL = isProduction 
    ? 'https://lw.gts.ai' 
    : 'http://localhost:5000';

export const PROJECTS = {
  OFFICE: "64469240-0c5d-471e-9008-9ccbf03672a3",
  HOUSE: "730284cd-4b8b-4975-a8bd-28df1e7aaa06",
  GYM: "d5490d37-77dc-4f6a-8f41-791e7268fbc4" 
};