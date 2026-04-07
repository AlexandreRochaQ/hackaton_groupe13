"""
Region detection module using rule-based heuristics for document layout analysis.
"""

import cv2
import numpy as np
from PIL import Image


class RegionDetector:
    """Rule-based region detector for administrative documents."""
    
    def __init__(self):
        """Initialize the region detector."""
        self.region_types = [
            'header',
            'company_block', 
            'invoice_info',
            'line_items',
            'totals_section'
        ]
    
    def detect_regions(self, image) -> dict:
        """
        Detect relevant regions in a document image using heuristics.
        
        Args:
            image: PIL Image or numpy array
            
        Returns:
            Dictionary mapping region names to bounding boxes (x1, y1, x2, y2)
        """
        if isinstance(image, Image.Image):
            image_np = np.array(image)
        else:
            image_np = image
        
        height, width = image_np.shape[:2]
        regions = {}
        
        gray = cv2.cvtColor(image_np, cv2.COLOR_RGB2GRAY)
        edges = cv2.Canny(gray, 50, 150)
        
        contours, _ = cv2.findContours(
            edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        
        text_regions = []
        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)
            if w > 50 and h > 20:
                text_regions.append((x, y, w, h))
        
        if not text_regions:
            regions = self._fallback_detection(width, height)
        else:
            regions = self._analyze_layout(text_regions, width, height)
        
        return regions
    
    def _fallback_detection(self, width: int, height: int) -> dict:
        """
        Fallback region detection based on typical document layout.
        
        Args:
            width: Image width
            height: Image height
            
        Returns:
            Dictionary of default region bounding boxes
        """
        return {
            'header': (0, int(height * 0.05), width, int(height * 0.15)),
            'company_block': (int(width * 0.05), int(height * 0.15), 
                            int(width * 0.45), int(height * 0.35)),
            'invoice_info': (int(width * 0.55), int(height * 0.15), 
                           int(width * 0.95), int(height * 0.35)),
            'totals_section': (int(width * 0.5), int(height * 0.75), 
                             int(width * 0.95), int(height * 0.95))
        }
    
    def _analyze_layout(self, text_regions: list, width: int, height: int) -> dict:
        """
        Analyze text regions to identify document sections.
        
        Args:
            text_regions: List of (x, y, w, h) tuples
            width: Image width
            height: Image height
            
        Returns:
            Dictionary of detected region bounding boxes
        """
        regions = {}
        
        top_regions = sorted(text_regions, key=lambda r: r[1])[:5]
        if top_regions:
            min_y = min(r[1] for r in top_regions)
            max_y = max(r[1] + r[3] for r in top_regions)
            regions['header'] = (0, min_y, width, max_y)
        
        left_regions = [r for r in text_regions if r[0] < width * 0.5]
        right_regions = [r for r in text_regions if r[0] >= width * 0.5]
        
        if left_regions:
            left_sorted = sorted(left_regions, key=lambda r: r[1])
            company_start = left_sorted[0][1] if len(left_sorted) > 0 else int(height * 0.15)
            company_end = left_sorted[-1][1] + left_sorted[-1][3] if len(left_sorted) > 0 else int(height * 0.35)
            regions['company_block'] = (
                int(width * 0.05), company_start, 
                int(width * 0.5), company_end
            )
        
        if right_regions:
            right_sorted = sorted(right_regions, key=lambda r: r[1])
            info_start = right_sorted[0][1] if len(right_sorted) > 0 else int(height * 0.15)
            info_end = right_sorted[-1][1] + right_sorted[-1][3] if len(right_sorted) > 0 else int(height * 0.35)
            regions['invoice_info'] = (
                int(width * 0.5), info_start,
                int(width * 0.95), info_end
            )
        
        bottom_regions = [r for r in text_regions if r[1] > height * 0.7]
        if bottom_regions:
            totals_sorted = sorted(bottom_regions, key=lambda r: r[0], reverse=True)
            totals = totals_sorted[0]
            regions['totals_section'] = (
                totals[0], totals[1],
                totals[0] + totals[2], totals[1] + totals[3]
            )
        
        if 'totals_section' not in regions:
            regions['totals_section'] = self._fallback_detection(width, height)['totals_section']
        
        return regions
    
    def crop_region(self, image, bbox: tuple) -> Image.Image:
        """
        Crop a region from an image based on bounding box.
        
        Args:
            image: PIL Image or numpy array
            bbox: Bounding box (x1, y1, x2, y2)
            
        Returns:
            Cropped PIL Image
        """
        if isinstance(image, Image.Image):
            img_np = np.array(image)
        else:
            img_np = image
            image = Image.fromarray(img_np)
        
        x1, y1, x2, y2 = map(int, bbox)
        
        x1 = max(0, min(x1, img_np.shape[1]))
        y1 = max(0, min(y1, img_np.shape[0]))
        x2 = max(x1, min(x2, img_np.shape[1]))
        y2 = max(y1, min(y2, img_np.shape[0]))
        
        cropped = image.crop((x1, y1, x2, y2))
        return cropped
    
    def extract_all_regions(self, image, regions: dict) -> dict:
        """
        Extract all specified regions from an image.
        
        Args:
            image: PIL Image or numpy array
            regions: Dictionary mapping region names to bounding boxes
            
        Returns:
            Dictionary mapping region names to cropped images
        """
        cropped_regions = {}
        for region_name, bbox in regions.items():
            try:
                cropped = self.crop_region(image, bbox)
                cropped_regions[region_name] = cropped
            except Exception as e:
                print(f"Error cropping {region_name}: {e}")
                continue
        
        return cropped_regions
