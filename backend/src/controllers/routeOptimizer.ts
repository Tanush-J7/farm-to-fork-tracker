import { Request, Response } from 'express';

// Mock AI Service to calculate route
export const getOptimalRoute = async (req: Request, res: Response) => {
  try {
    const { origin, destination, category } = req.body;

    // Simulate AI delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Dynamic mock response based on category
    let routeDesc = '';
    let estTime = '';
    let risk = '';

    if (category === 'Dairy' || category === 'Meat') {
      routeDesc = 'Express Route NH-4 (Avoids Traffic)';
      estTime = '2h 15m';
      risk = 'Medium (Requires strict 2°C-4°C chill)';
    } else if (category === 'Fruits' || category === 'Vegetables') {
      routeDesc = 'Standard Route I-5';
      estTime = '4h 30m';
      risk = 'Low (Requires 8°C-12°C)';
    } else {
      routeDesc = 'Eco Route (Fuel Saving)';
      estTime = '5h 00m';
      risk = 'Low (Ambient temp acceptable)';
    }

    const routeData = {
      path: [origin, 'Waypoint Alpha', 'Checkpoint Bravo', destination],
      description: routeDesc,
      estimatedTime: estTime,
      coldChainRisk: risk,
      weatherWarning: 'Clear skies, no delays expected.'
    };

    res.status(200).json({ success: true, data: routeData });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
