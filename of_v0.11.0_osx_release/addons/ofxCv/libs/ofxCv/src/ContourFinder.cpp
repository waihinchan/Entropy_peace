#include "ofxCv/ContourFinder.h"
#include "ofxCv/Wrappers.h"
#include "ofGraphics.h"

namespace ofxCv {
    using namespace std;

	struct CompareContourArea
	{
		CompareContourArea(const std::vector<double>& areaVec)
		: mAreaVec(areaVec) {}

		// Sort contour indices into decreasing order, based on a vector of
		// contour areas.  Later, we will use these indices to order the
		// contours (which are stored in a separate vector).
		bool operator()(size_t a, size_t b) const
		{
			return mAreaVec[a] > mAreaVec[b];
		}

		const std::vector<double>& mAreaVec;
	};
	
	ContourFinder::ContourFinder()
	:autoThreshold(true)
	,invert(false)
	,simplify(true)
	,thresholdValue(128.)
	,useTargetColor(false)
	,contourFindingMode(CV_RETR_EXTERNAL)
	,sortBySize(false) {
		resetMinArea();
		resetMaxArea();
	}
	
	void ContourFinder::findContours(cv::Mat img) {
		// threshold the image using a tracked color or just binary grayscale
		if(useTargetColor) {
			cv::Scalar offset(thresholdValue, thresholdValue, thresholdValue);
			cv::Scalar base = toCv(targetColor);
			if(trackingColorMode == TRACK_COLOR_RGB) {
				inRange(img, base - offset, base + offset, thresh);
			} else {
                // all the HSV modes are broken incorrect,
                // because opencv uses hue 0-180 not 0-255
                // which means that the math doesn't wrap.
				if(trackingColorMode == TRACK_COLOR_H) {
					offset[1] = 255;
					offset[2] = 255;
				}
				if(trackingColorMode == TRACK_COLOR_HS) {
					offset[2] = 255;
				}
				cvtColor(img, hsvBuffer, CV_RGB2HSV);
				base = toCv(convertColor(targetColor, CV_RGB2HSV));
				cv::Scalar lowerb = base - offset;
				cv::Scalar upperb = base + offset;
				inRange(hsvBuffer, lowerb, upperb, thresh);
			}
		} else {
            copyGray(img, thresh);
		}
		if(autoThreshold) {
			threshold(thresh, thresholdValue, invert);
		}
		
		// run the contour finder
		std::vector<std::vector<cv::Point> > allContours;
		int simplifyMode = simplify ? CV_CHAIN_APPROX_SIMPLE : CV_CHAIN_APPROX_NONE;
		cv::findContours(thresh, allContours, contourFindingMode, simplifyMode);
		
		// filter the contours
		bool needMinFilter = (minArea > 0);
		bool needMaxFilter = maxAreaNorm ? (maxArea < 1) : (maxArea < std::numeric_limits<float>::infinity());
		std::vector<size_t> allIndices;
		std::vector<double> allAreas;
        std::vector<bool> allHoles;
		if(needMinFilter || needMaxFilter) {
			double imgArea = img.rows * img.cols;
			double imgMinArea = minAreaNorm ? (minArea * imgArea) : minArea;
			double imgMaxArea = maxAreaNorm ? (maxArea * imgArea) : maxArea;
			for(size_t i = 0; i < allContours.size(); i++) {
				double curArea = cv::contourArea(cv::Mat(allContours[i]), true);
                bool hole = true;
                if(curArea < 0) {
                    curArea = -curArea;
                    hole = false;
                }

				if((!needMinFilter || curArea >= imgMinArea) &&
					 (!needMaxFilter || curArea <= imgMaxArea)) {
					allIndices.push_back(i);
                    allHoles.push_back(hole);
                    allAreas.push_back(curArea);
				}
			}
		} else {
			for(size_t i = 0; i < allContours.size(); i++) {
                double curArea = cv::contourArea(cv::Mat(allContours[i]), true);
                allAreas.push_back(abs(curArea));
                allHoles.push_back(curArea > 0);
				allIndices.push_back(i);
			}
		}

		if (allIndices.size() > 1 && sortBySize) {
			// Sort contour indices, based on a separate vector of areas.
			std::sort(allIndices.begin(), allIndices.end(), CompareContourArea(allAreas));
		}

		// generate polylines and bounding boxes from the contours
		contours.clear();
		polylines.clear();
        boundingRects.clear();
        holes.clear();

		for(size_t i = 0; i < allIndices.size(); i++) {
			contours.push_back(allContours[allIndices[i]]);
			polylines.push_back(toOf(contours.back()));
			boundingRects.push_back(boundingRect(contours.back()));
            holes.push_back(allHoles[i]);
		}
		
		// track bounding boxes
		tracker.track(boundingRects);
	}
	

	void ContourFinder::setFindHoles(bool findHoles){
		if(findHoles){
			contourFindingMode = CV_RETR_LIST;
		}else{
			contourFindingMode = CV_RETR_EXTERNAL;
		}
	}

	void ContourFinder::setSortBySize(bool sizeSort) {
		sortBySize = sizeSort;
	}

	const std::vector<std::vector<cv::Point> >& ContourFinder::getContours() const {
		return contours;
	}
	
	const std::vector<ofPolyline>& ContourFinder::getPolylines() const {
		return polylines;
	}
	
	const std::vector<cv::Rect>& ContourFinder::getBoundingRects() const {
		return boundingRects;
	}
	
	unsigned int ContourFinder::size() const {
		return contours.size();
	}
	
	std::vector<cv::Point>& ContourFinder::getContour(unsigned int i) {
		return contours[i];
	}
	
	ofPolyline& ContourFinder::getPolyline(unsigned int i) {
		return polylines[i];
	}
	
	cv::Rect ContourFinder::getBoundingRect(unsigned int i) const {
		return boundingRects[i];
	}
	
	cv::Point2f ContourFinder::getCenter(unsigned int i) const {
		cv::Rect box = getBoundingRect(i);
		return cv::Point2f(box.x + box.width / 2, box.y + box.height / 2);
	}
	
	cv::Point2f ContourFinder::getCentroid(unsigned int i) const {
		cv::Moments m = moments(contours[i]);
		if(m.m00!=0){
			return cv::Point2f(m.m10 / m.m00, m.m01 / m.m00);
		}else{
			return cv::Point2f(0, 0);
		}
	}
	
	cv::Point2f ContourFinder::getAverage(unsigned int i) const {
		cv::Scalar average = mean(contours[i]);
		return cv::Point2f(average[0], average[1]);
	}
	
	cv::Vec2f ContourFinder::getBalance(unsigned int i) const {
		return cv::Vec2f(getCentroid(i) - getCenter(i));
	}
	
	double ContourFinder::getContourArea(unsigned int i) const {
		return contourArea(contours[i]);
	}
	
	double ContourFinder::getArcLength(unsigned int i) const {
		return arcLength(contours[i], true);
	}
	
	std::vector<cv::Point> ContourFinder::getConvexHull(unsigned int i) const {
		std::vector<cv::Point> hull;
		convexHull(contours[i], hull);
		return hull;
	}
	
	std::vector<cv::Vec4i> ContourFinder::getConvexityDefects(unsigned int i) const {
		return convexityDefects(contours[i]);
	}
	
	cv::RotatedRect ContourFinder::getMinAreaRect(unsigned int i) const {
		return minAreaRect(contours[i]);
	}
	
	cv::Point2f ContourFinder::getMinEnclosingCircle(unsigned int i, float& radius) const {
		cv::Point2f center;
		minEnclosingCircle(contours[i], center, radius);
		return center;
	}
	
	cv::RotatedRect ContourFinder::getFitEllipse(unsigned int i) const {
		if(contours[i].size() < 5) {
			return getMinAreaRect(i);
		}
		return fitEllipse(contours[i]);
	}
	
	std::vector<cv::Point> ContourFinder::getFitQuad(unsigned int i) const {
		std::vector<cv::Point> convexHull = getConvexHull(i);
		std::vector<cv::Point> quad = convexHull;
		
		static const unsigned int targetPoints = 4;
		static const unsigned int maxIterations = 16;
		static const double infinity = std::numeric_limits<double>::infinity();
		double minEpsilon = 0;
		double maxEpsilon = infinity;
		double curEpsilon = 16; // good initial guess
		
		// unbounded binary search to simplify the convex hull until it's 4 points
		if(quad.size() > 4) {
			for(int i = 0; i <(int) maxIterations; i++) {
                cv::approxPolyDP(cv::Mat(convexHull), quad, curEpsilon, true);
				if(quad.size() == targetPoints) {
					break;
				}
				if(quad.size() > targetPoints) {
					minEpsilon = curEpsilon;
					if(maxEpsilon == infinity) {
						curEpsilon = curEpsilon *  2;
					} else {
						curEpsilon = (maxEpsilon + minEpsilon) / 2;
					}
				}
				if(quad.size() < targetPoints) {
					maxEpsilon = curEpsilon;
					curEpsilon = (maxEpsilon + minEpsilon) / 2;
				}
			}
		}
		
		return quad;
    }
    
    bool ContourFinder::getHole(unsigned int i) const {
        return holes[i];
    }
	
	cv::Vec2f ContourFinder::getVelocity(unsigned int i) const {
		return tracker.getVelocity(i);
	}
    
	unsigned int ContourFinder::getLabel(unsigned int i) const {
		return tracker.getCurrentLabels()[i];
	}
	
	RectTracker& ContourFinder::getTracker() {
		return tracker;
	}
	
    double ContourFinder::pointPolygonTest(unsigned int i, cv::Point2f point) {
        return cv::pointPolygonTest(contours[i], point, true);
    }
    
	void ContourFinder::setAutoThreshold(bool autoThreshold) {
		this->autoThreshold = autoThreshold;
	}
	
	void ContourFinder::setThreshold(float thresholdValue) {
		this->thresholdValue = thresholdValue;
	}
	
	void ContourFinder::setInvert(bool invert) {
		this->invert = invert;
	}
    
    void ContourFinder::setUseTargetColor(bool useTargetColor) {
        this->useTargetColor = useTargetColor;
    }
	
	void ContourFinder::setTargetColor(ofColor targetColor, TrackingColorMode trackingColorMode) {
		useTargetColor = true;
		this->targetColor = targetColor;
		this->trackingColorMode = trackingColorMode;
	}
	
	void ContourFinder::setSimplify(bool simplify) {
		this->simplify = simplify;
	}
	
	void ContourFinder::draw() const {
		ofPushStyle();
		ofNoFill();
        for(std::size_t i = 0; i < polylines.size(); i++) {
			polylines[i].draw();
			ofDrawRectangle(toOf(getBoundingRect(i)));
		}
		ofPopStyle();
	}
	
	void ContourFinder::resetMinArea() {
		setMinArea(0);
	}
	
	void ContourFinder::resetMaxArea() {
		setMaxArea(std::numeric_limits<float>::infinity());
	}
	
	void ContourFinder::setMinArea(float minArea) {
		this->minArea = minArea;
		minAreaNorm = false;
	}
	
	void ContourFinder::setMaxArea(float maxArea) {
		this->maxArea = maxArea;
		maxAreaNorm = false;
	}
	
	void ContourFinder::setMinAreaRadius(float minAreaRadius) {
		minArea = PI * minAreaRadius * minAreaRadius;
		minAreaNorm = false;
	}
	
	void ContourFinder::setMaxAreaRadius(float maxAreaRadius) {
		maxArea = PI * maxAreaRadius * maxAreaRadius;
		maxAreaNorm = false;
	}
	
	void ContourFinder::setMinAreaNorm(float minAreaNorm) {
		minArea = minAreaNorm;
		this->minAreaNorm = true;
	}
	
	void ContourFinder::setMaxAreaNorm(float maxAreaNorm) {
		maxArea = maxAreaNorm;
		this->maxAreaNorm = true;
	}
	
}
