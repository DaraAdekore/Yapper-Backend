"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageType = void 0;
var MessageType;
(function (MessageType) {
    MessageType["SEND_MESSAGE"] = "SEND_MESSAGE";
    MessageType["NEW_MESSAGE"] = "NEW_MESSAGE";
    MessageType["JOIN_ROOM"] = "JOIN_ROOM";
    MessageType["USER_JOINED"] = "USER_JOINED";
    MessageType["ROOM_CREATED"] = "ROOM_CREATED";
    MessageType["CREATE_ROOM"] = "CREATE_ROOM";
    MessageType["MEMBERSHIP_STATUS"] = "MEMBERSHIP_STATUS";
    MessageType["ERROR"] = "ERROR";
    MessageType["LOAD_ROOM_MESSAGES"] = "LOAD_ROOM_MESSAGES";
    MessageType["ROOMS_UPDATE"] = "ROOMS_UPDATE";
    MessageType["NEARBY_ROOMS"] = "NEARBY_ROOMS";
})(MessageType || (exports.MessageType = MessageType = {}));
