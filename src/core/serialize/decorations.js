/*
Copyright 2020 Adobe
All Rights Reserved.

NOTICE: Adobe permits you to use, modify, and distribute this file in
accordance with the terms of the Adobe license agreement accompanying
it. If you have received this file from a source other than Adobe,
then your use, modification, or distribution of it requires the prior
written permission of Adobe. 
*/

// Serialization methods related to Container BoxDecoration

const xd = require("scenegraph");

const $ = require("../../utils/utils");
const { getOpacity } = require("../../utils/nodeutils");
const { getColor } = require("./colors");
const { getAssetImage } = require("./core");
const { getBoxFit } = require("./layout");
const { getGradientParam } = require("./gradients");

/** BOXDECORATION */
function getColorOrDecorationParam(xdNode, serializer, ctx, parameters) {
	if (!xdNode.stroke && !xdNode.hasRoundedCorners && !xdNode.shadow && xdNode.fill instanceof xd.Color) {
		return _getFillParam(xdNode, serializer, ctx, parameters);
	} else {
		return getDecorationParam(xdNode, serializer, ctx, parameters);
	}
}
exports.getColorOrDecorationParam = getColorOrDecorationParam;

function getDecorationParam(o, serializer, ctx, parameters) {
	return `decoration: ${_getBoxDecoration(o, serializer, ctx, parameters)}, `;
}
exports.getDecorationParam = getDecorationParam;

function _getBoxDecoration(xdNode, serializer, ctx, parameters) {
	let str = $.getParamList([
		_getBorderRadiusParam(xdNode, serializer, ctx, parameters),
		_getFillParam(xdNode, serializer, ctx, parameters),
		_getBorderParam(xdNode, serializer, ctx, parameters),
		_getBoxShadowParam(xdNode, serializer, ctx, parameters)
	]);
	return "BoxDecoration(" + str + ")";
}

/** FILL & STROKE */
function _getFillParam(xdNode, serializer, ctx, parameters) {
	if (!xdNode.fillEnabled || !xdNode.fill) { return ""; }
	let fill = xdNode.fill, blur = xdNode.blur;
	let fillOpacityFromBlur = (blur && blur.visible && blur.isBackgroundEffect) ? blur.fillOpacity : 1.0;
	let opacity = getOpacity(xdNode) * fillOpacityFromBlur;
	if (fill instanceof xd.Color) {
		let colorParameter = parameters["fill"].isOwn
			? getColor(xdNode.fill, opacity)
			: parameters["fill"].name;
		return `color: ${colorParameter}, `;
	}
	if (fill instanceof xd.ImageFill) {
		let imageParam = parameters["fill"].isOwn
			? getAssetImage(xdNode, serializer, ctx)
			: parameters["fill"].name;
		return "image: DecorationImage("+
			`  image: ${imageParam},` +
			`  fit: ${getBoxFit(fill.scaleBehavior)},` +
			_getOpacityColorFilterParam(opacity) +
			"), ";
	}
	let gradient = getGradientParam(fill, opacity);
	if (gradient) { return gradient; }
	ctx.log.warn(`Unrecognized fill type ('${fill.constructor.name}').`, xdNode);
}

function _getOpacityColorFilterParam(opacity) {
	if (opacity >= 1) { return ''; }
	return `colorFilter: new ColorFilter.mode(Colors.black.withOpacity(${$.fix(opacity, 2)}), BlendMode.dstIn), `;
}

function _getBorderParam(xdNode, serializer, ctx, parameters) {
	if (xdNode.strokePosition !== xd.GraphicNode.INNER_STROKE) {
		ctx.log.warn('Only inner strokes are supported on rectangles & ellipses.', xdNode);
	}
	if (xdNode.strokeJoins !== xd.GraphicNode.STROKE_JOIN_MITER) {
		ctx.log.warn('Only miter stroke joins are supported on rectangles & ellipses.', xdNode);
	}
	let dashes = xdNode.strokeDashArray;
	if (dashes && dashes.length && dashes.reduce((a, b) => a + b)) {
		ctx.log.warn('Dashed lines are not supported on rectangles & ellipses.', xdNode);
	}
	let strokeEnableParamRef = parameters["strokeEnabled"];
	let strokeEnableParam = strokeEnableParamRef.parameter;
	let strokeParam = parameters["stroke"].isOwn
		? xdNode.stroke && getColor(xdNode.stroke, getOpacity(xdNode))
		: parameters["stroke"].name;
	if (!strokeParam) { return ""; }

	if (strokeEnableParamRef.isOwn) {
		if (!xdNode.strokeEnabled || !xdNode.stroke) { return ""; }
		return `border: Border.all(width: ${$.fix(xdNode.strokeWidth, 2)}, color: ${strokeParam}), `;
	} else {
		return `border: ${strokeEnableParam.name} ? Border.all(width: ${$.fix(xdNode.strokeWidth, 2)}, color: ${strokeParam}) : null, `;
	}
}


/** BORDERRADIUS */
function _getBorderRadiusParam(o, serializer, ctx) {
	let radiusStr;
	if (o instanceof xd.Ellipse) {
		radiusStr = _getBorderRadiusForEllipse(o, serializer, ctx);
	} else if (o.hasRoundedCorners) {
		radiusStr = _getBorderRadiusForRectangle(o, serializer, ctx);
	}
	return radiusStr ? `borderRadius: ${radiusStr}, ` : "";
}

function _getBorderRadiusForEllipse(o, serializer, ctx) {
	return `BorderRadius.all(Radius.elliptical(${$.fix(o.radiusX, 2)}, ${$.fix(o.radiusY, 2)}))`;
}

function _getBorderRadiusForRectangle(o, serializer, ctx) {
	let radii = o.cornerRadii;
	let tl = radii.topLeft, tr = radii.topRight, br = radii.bottomRight, bl = radii.bottomLeft;
	if (tl === tr && tl === br && tl === bl) {
		return `BorderRadius.circular(${$.fix(tl, 2)})`;
	} else {
		return 'BorderRadius.only(' +
			_getRadiusParam("topLeft", tl) +
			_getRadiusParam("topRight", tr) +
			_getRadiusParam("bottomRight", br) +
			_getRadiusParam("bottomLeft", bl) +
			')';
	}
}

function _getRadiusParam(param, value) {
	if (value <= 1) { return ''; }
	return `${param}: Radius.circular(${$.fix(value, 2)}), `;
}


/** SHADOWS */
function _getBoxShadowParam(xdNode, serializer, ctx) {
	let s = xdNode.shadow;
	if (!s || !s.visible) { return ""; }
	return `boxShadow: [BoxShadow(color: ${getColor(s.color, getOpacity(xdNode))}, offset: Offset(${s.x}, ${s.y}), blurRadius: ${s.blur}, ), ], `;
}