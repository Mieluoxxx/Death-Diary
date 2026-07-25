/**
 * Original Buried-City site produce tables.
 * Values are a site-wide budget; mapSystem distributes the rolled items over work rooms.
 */

export type WeightedSiteLoot = {
    itemId: string;
    weight: number;
};

export type SiteProduceConfig = {
    produceValue: number;
    produceList: readonly WeightedSiteLoot[];
};

export const SITE_PRODUCE_CONFIG = {
    "1": {
        "produceValue": 62,
        "produceList": [
            {
                "itemId": "1101011",
                "weight": 10
            },
            {
                "itemId": "1101021",
                "weight": 10
            },
            {
                "itemId": "1101031",
                "weight": 4
            },
            {
                "itemId": "1101041",
                "weight": 3
            },
            {
                "itemId": "1101051",
                "weight": 5
            },
            {
                "itemId": "1101**",
                "weight": 10
            },
            {
                "itemId": "1102011",
                "weight": 0
            },
            {
                "itemId": "1103*1",
                "weight": 0
            },
            {
                "itemId": "1104011",
                "weight": 0
            },
            {
                "itemId": "1104021",
                "weight": 1
            },
            {
                "itemId": "1104043",
                "weight": 0
            },
            {
                "itemId": "1105011",
                "weight": 5
            },
            {
                "itemId": "1105042",
                "weight": 0
            },
            {
                "itemId": "1105**",
                "weight": 0
            },
            {
                "itemId": "1305011",
                "weight": 0
            },
            {
                "itemId": "1103083",
                "weight": 0
            },
            {
                "itemId": "1102**",
                "weight": 0
            },
            {
                "itemId": "1301**",
                "weight": 0
            },
            {
                "itemId": "1105022",
                "weight": 0
            },
            {
                "itemId": "1105033",
                "weight": 0
            },
            {
                "itemId": "1302*1",
                "weight": 0
            },
            {
                "itemId": "1106013",
                "weight": 0
            }
        ]
    },
    "2": {
        "produceValue": 347,
        "produceList": [
            {
                "itemId": "1101011",
                "weight": 15
            },
            {
                "itemId": "1101021",
                "weight": 15
            },
            {
                "itemId": "1101031",
                "weight": 6
            },
            {
                "itemId": "1101041",
                "weight": 5
            },
            {
                "itemId": "1101051",
                "weight": 5
            },
            {
                "itemId": "1101**",
                "weight": 10
            },
            {
                "itemId": "1102011",
                "weight": 1
            },
            {
                "itemId": "1103*1",
                "weight": 10
            },
            {
                "itemId": "1104011",
                "weight": 5
            },
            {
                "itemId": "1104021",
                "weight": 5
            },
            {
                "itemId": "1104043",
                "weight": 0
            },
            {
                "itemId": "1105011",
                "weight": 10
            },
            {
                "itemId": "1105042",
                "weight": 2
            },
            {
                "itemId": "1105**",
                "weight": 0
            },
            {
                "itemId": "1305011",
                "weight": 30
            },
            {
                "itemId": "1103083",
                "weight": 3
            },
            {
                "itemId": "1102**",
                "weight": 2
            },
            {
                "itemId": "1301**",
                "weight": 0
            },
            {
                "itemId": "1105022",
                "weight": 5
            },
            {
                "itemId": "1105033",
                "weight": 1
            },
            {
                "itemId": "1302*1",
                "weight": 1
            },
            {
                "itemId": "1106013",
                "weight": 0
            },
            {
                "itemId": "1101071",
                "weight": 5
            }
        ]
    },
    "3": {
        "produceValue": 173,
        "produceList": [
            {
                "itemId": "1101011",
                "weight": 15
            },
            {
                "itemId": "1101021",
                "weight": 10
            },
            {
                "itemId": "1101031",
                "weight": 4
            },
            {
                "itemId": "1101041",
                "weight": 4
            },
            {
                "itemId": "1101051",
                "weight": 4
            },
            {
                "itemId": "1101**",
                "weight": 10
            },
            {
                "itemId": "1102011",
                "weight": 1
            },
            {
                "itemId": "1103*1",
                "weight": 0
            },
            {
                "itemId": "1104011",
                "weight": 2
            },
            {
                "itemId": "1104021",
                "weight": 2
            },
            {
                "itemId": "1104043",
                "weight": 0
            },
            {
                "itemId": "1105011",
                "weight": 5
            },
            {
                "itemId": "1105042",
                "weight": 0
            },
            {
                "itemId": "1105**",
                "weight": 0
            },
            {
                "itemId": "1305011",
                "weight": 20
            },
            {
                "itemId": "1103083",
                "weight": 2
            },
            {
                "itemId": "1102**",
                "weight": 1
            },
            {
                "itemId": "1301**",
                "weight": 0
            },
            {
                "itemId": "1105022",
                "weight": 3
            },
            {
                "itemId": "1105033",
                "weight": 0
            },
            {
                "itemId": "1302*1",
                "weight": 1
            },
            {
                "itemId": "1106013",
                "weight": 0
            },
            {
                "itemId": "1101071",
                "weight": 2
            }
        ]
    },
    "4": {
        "produceValue": 96,
        "produceList": [
            {
                "itemId": "1101011",
                "weight": 5
            },
            {
                "itemId": "1101021",
                "weight": 6
            },
            {
                "itemId": "1101031",
                "weight": 1
            },
            {
                "itemId": "1101041",
                "weight": 4
            },
            {
                "itemId": "1101051",
                "weight": 10
            },
            {
                "itemId": "1101**",
                "weight": 10
            },
            {
                "itemId": "1102011",
                "weight": 0
            },
            {
                "itemId": "1103*1",
                "weight": 30
            },
            {
                "itemId": "1104011",
                "weight": 0
            },
            {
                "itemId": "1104021",
                "weight": 1
            },
            {
                "itemId": "1104043",
                "weight": 0
            },
            {
                "itemId": "1105011",
                "weight": 0
            },
            {
                "itemId": "1105042",
                "weight": 3
            },
            {
                "itemId": "1105**",
                "weight": 0
            },
            {
                "itemId": "1305011",
                "weight": 0
            },
            {
                "itemId": "1103083",
                "weight": 5
            },
            {
                "itemId": "1102**",
                "weight": 0
            },
            {
                "itemId": "1301**",
                "weight": 0
            },
            {
                "itemId": "1105022",
                "weight": 0
            },
            {
                "itemId": "1105033",
                "weight": 0
            },
            {
                "itemId": "1302*1",
                "weight": 0
            },
            {
                "itemId": "1106013",
                "weight": 0
            }
        ]
    },
    "5": {
        "produceValue": 43,
        "produceList": [
            {
                "itemId": "1101011",
                "weight": 10
            },
            {
                "itemId": "1101021",
                "weight": 10
            },
            {
                "itemId": "1101031",
                "weight": 10
            },
            {
                "itemId": "1101041",
                "weight": 10
            },
            {
                "itemId": "1101051",
                "weight": 10
            },
            {
                "itemId": "1101**",
                "weight": 10
            },
            {
                "itemId": "1102011",
                "weight": 0
            },
            {
                "itemId": "1103*1",
                "weight": 0
            },
            {
                "itemId": "1104011",
                "weight": 0
            },
            {
                "itemId": "1104021",
                "weight": 0
            },
            {
                "itemId": "1104043",
                "weight": 0
            },
            {
                "itemId": "1105011",
                "weight": 0
            },
            {
                "itemId": "1105042",
                "weight": 0
            },
            {
                "itemId": "1105**",
                "weight": 0
            },
            {
                "itemId": "1305011",
                "weight": 0
            },
            {
                "itemId": "1103083",
                "weight": 0
            },
            {
                "itemId": "1102**",
                "weight": 0
            },
            {
                "itemId": "1301**",
                "weight": 0
            },
            {
                "itemId": "1105022",
                "weight": 0
            },
            {
                "itemId": "1105033",
                "weight": 0
            },
            {
                "itemId": "1302*1",
                "weight": 0
            },
            {
                "itemId": "1106013",
                "weight": 0
            }
        ]
    },
    "6": {
        "produceValue": 64,
        "produceList": [
            {
                "itemId": "1101011",
                "weight": 10
            },
            {
                "itemId": "1101021",
                "weight": 5
            },
            {
                "itemId": "1101031",
                "weight": 0
            },
            {
                "itemId": "1101041",
                "weight": 5
            },
            {
                "itemId": "1101051",
                "weight": 5
            },
            {
                "itemId": "1101**",
                "weight": 10
            },
            {
                "itemId": "1102011",
                "weight": 0
            },
            {
                "itemId": "1103*1",
                "weight": 20
            },
            {
                "itemId": "1104011",
                "weight": 0
            },
            {
                "itemId": "1104021",
                "weight": 0
            },
            {
                "itemId": "1104043",
                "weight": 0
            },
            {
                "itemId": "1105011",
                "weight": 10
            },
            {
                "itemId": "1105042",
                "weight": 2
            },
            {
                "itemId": "1105**",
                "weight": 0
            },
            {
                "itemId": "1305011",
                "weight": 0
            },
            {
                "itemId": "1103083",
                "weight": 0
            },
            {
                "itemId": "1102**",
                "weight": 0
            },
            {
                "itemId": "1301**",
                "weight": 0
            },
            {
                "itemId": "1105022",
                "weight": 0
            },
            {
                "itemId": "1105033",
                "weight": 0
            },
            {
                "itemId": "1302*1",
                "weight": 0
            },
            {
                "itemId": "1106013",
                "weight": 0
            }
        ]
    },
    "7": {
        "produceValue": 100,
        "produceList": [
            {
                "itemId": "1101011",
                "weight": 0
            },
            {
                "itemId": "1101021",
                "weight": 4
            },
            {
                "itemId": "1101031",
                "weight": 0
            },
            {
                "itemId": "1101041",
                "weight": 4
            },
            {
                "itemId": "1101051",
                "weight": 0
            },
            {
                "itemId": "1101**",
                "weight": 1
            },
            {
                "itemId": "1102011",
                "weight": 0
            },
            {
                "itemId": "1102042",
                "weight": 8
            },
            {
                "itemId": "1103*1",
                "weight": 0
            },
            {
                "itemId": "1104011",
                "weight": 0
            },
            {
                "itemId": "1104021",
                "weight": 0
            },
            {
                "itemId": "1104043",
                "weight": 0
            },
            {
                "itemId": "1105011",
                "weight": 4
            },
            {
                "itemId": "1105042",
                "weight": 0
            },
            {
                "itemId": "1105**",
                "weight": 0
            },
            {
                "itemId": "1305011",
                "weight": 1
            },
            {
                "itemId": "1103083",
                "weight": 0
            },
            {
                "itemId": "1102**",
                "weight": 0
            },
            {
                "itemId": "1301**",
                "weight": 0
            },
            {
                "itemId": "1105022",
                "weight": 0
            },
            {
                "itemId": "1105033",
                "weight": 0
            },
            {
                "itemId": "1302*1",
                "weight": 0
            },
            {
                "itemId": "1106013",
                "weight": 0
            }
        ]
    },
    "8": {
        "produceValue": 242,
        "produceList": [
            {
                "itemId": "1101011",
                "weight": 10
            },
            {
                "itemId": "1101021",
                "weight": 5
            },
            {
                "itemId": "1101031",
                "weight": 0
            },
            {
                "itemId": "1101041",
                "weight": 5
            },
            {
                "itemId": "1101051",
                "weight": 5
            },
            {
                "itemId": "1101**",
                "weight": 10
            },
            {
                "itemId": "1102011",
                "weight": 0
            },
            {
                "itemId": "1103*1",
                "weight": 0
            },
            {
                "itemId": "1104011",
                "weight": 0
            },
            {
                "itemId": "1104021",
                "weight": 1
            },
            {
                "itemId": "1104043",
                "weight": 0
            },
            {
                "itemId": "1105011",
                "weight": 100
            },
            {
                "itemId": "1105042",
                "weight": 0
            },
            {
                "itemId": "1105**",
                "weight": 0
            },
            {
                "itemId": "1305011",
                "weight": 0
            },
            {
                "itemId": "1103083",
                "weight": 0
            },
            {
                "itemId": "1102**",
                "weight": 0
            },
            {
                "itemId": "1301**",
                "weight": 0
            },
            {
                "itemId": "1105022",
                "weight": 0
            },
            {
                "itemId": "1105033",
                "weight": 0
            },
            {
                "itemId": "1302*1",
                "weight": 0
            },
            {
                "itemId": "1106013",
                "weight": 0
            }
        ]
    },
    "9": {
        "produceValue": 201,
        "produceList": [
            {
                "itemId": "1101011",
                "weight": 100
            },
            {
                "itemId": "1101021",
                "weight": 50
            },
            {
                "itemId": "1101031",
                "weight": 20
            },
            {
                "itemId": "1101041",
                "weight": 20
            },
            {
                "itemId": "1101051",
                "weight": 20
            },
            {
                "itemId": "1101**",
                "weight": 20
            },
            {
                "itemId": "1102011",
                "weight": 0
            },
            {
                "itemId": "1103*1",
                "weight": 0
            },
            {
                "itemId": "1104011",
                "weight": 0
            },
            {
                "itemId": "1104021",
                "weight": 0
            },
            {
                "itemId": "1104043",
                "weight": 0
            },
            {
                "itemId": "1105011",
                "weight": 0
            },
            {
                "itemId": "1105042",
                "weight": 0
            },
            {
                "itemId": "1105**",
                "weight": 0
            },
            {
                "itemId": "1305011",
                "weight": 0
            },
            {
                "itemId": "1103083",
                "weight": 0
            },
            {
                "itemId": "1102**",
                "weight": 0
            },
            {
                "itemId": "1301**",
                "weight": 0
            },
            {
                "itemId": "1105022",
                "weight": 0
            },
            {
                "itemId": "1105033",
                "weight": 0
            },
            {
                "itemId": "1302*1",
                "weight": 1
            },
            {
                "itemId": "1106013",
                "weight": 0
            }
        ]
    },
    "10": {
        "produceValue": 141,
        "produceList": [
            {
                "itemId": "1101011",
                "weight": 20
            },
            {
                "itemId": "1101021",
                "weight": 5
            },
            {
                "itemId": "1101031",
                "weight": 10
            },
            {
                "itemId": "1101041",
                "weight": 5
            },
            {
                "itemId": "1101051",
                "weight": 1
            },
            {
                "itemId": "1101**",
                "weight": 10
            },
            {
                "itemId": "1102011",
                "weight": 1
            },
            {
                "itemId": "1103*1",
                "weight": 0
            },
            {
                "itemId": "1104011",
                "weight": 1
            },
            {
                "itemId": "1104021",
                "weight": 1
            },
            {
                "itemId": "1104043",
                "weight": 0
            },
            {
                "itemId": "1105011",
                "weight": 5
            },
            {
                "itemId": "1105042",
                "weight": 2
            },
            {
                "itemId": "1105**",
                "weight": 0
            },
            {
                "itemId": "1305011",
                "weight": 25
            },
            {
                "itemId": "1103083",
                "weight": 1
            },
            {
                "itemId": "1102**",
                "weight": 2
            },
            {
                "itemId": "1301**",
                "weight": 0
            },
            {
                "itemId": "1105022",
                "weight": 1
            },
            {
                "itemId": "1105033",
                "weight": 0
            },
            {
                "itemId": "1302*1",
                "weight": 1
            },
            {
                "itemId": "1106013",
                "weight": 0
            }
        ]
    },
    "11": {
        "produceValue": 362,
        "produceList": [
            {
                "itemId": "1101011",
                "weight": 15
            },
            {
                "itemId": "1101021",
                "weight": 10
            },
            {
                "itemId": "1101031",
                "weight": 5
            },
            {
                "itemId": "1101041",
                "weight": 5
            },
            {
                "itemId": "1101051",
                "weight": 5
            },
            {
                "itemId": "1101**",
                "weight": 10
            },
            {
                "itemId": "1102011",
                "weight": 1
            },
            {
                "itemId": "1103*1",
                "weight": 20
            },
            {
                "itemId": "1104011",
                "weight": 2
            },
            {
                "itemId": "1104021",
                "weight": 2
            },
            {
                "itemId": "1104043",
                "weight": 1
            },
            {
                "itemId": "1105011",
                "weight": 20
            },
            {
                "itemId": "1105042",
                "weight": 2
            },
            {
                "itemId": "1105**",
                "weight": 0
            },
            {
                "itemId": "1305011",
                "weight": 40
            },
            {
                "itemId": "1103083",
                "weight": 5
            },
            {
                "itemId": "1102**",
                "weight": 2
            },
            {
                "itemId": "1301**",
                "weight": 0
            },
            {
                "itemId": "1105022",
                "weight": 5
            },
            {
                "itemId": "1105033",
                "weight": 3
            },
            {
                "itemId": "1302*1",
                "weight": 1
            },
            {
                "itemId": "1106013",
                "weight": 0
            }
        ]
    },
    "12": {
        "produceValue": 169,
        "produceList": [
            {
                "itemId": "1101011",
                "weight": 10
            },
            {
                "itemId": "1101021",
                "weight": 10
            },
            {
                "itemId": "1101031",
                "weight": 1
            },
            {
                "itemId": "1101041",
                "weight": 5
            },
            {
                "itemId": "1101051",
                "weight": 1
            },
            {
                "itemId": "1101**",
                "weight": 10
            },
            {
                "itemId": "1102011",
                "weight": 2
            },
            {
                "itemId": "1103*1",
                "weight": 0
            },
            {
                "itemId": "1104011",
                "weight": 1
            },
            {
                "itemId": "1104021",
                "weight": 1
            },
            {
                "itemId": "1104043",
                "weight": 0
            },
            {
                "itemId": "1105011",
                "weight": 0
            },
            {
                "itemId": "1105042",
                "weight": 0
            },
            {
                "itemId": "1105**",
                "weight": 0
            },
            {
                "itemId": "1305011",
                "weight": 60
            },
            {
                "itemId": "1103083",
                "weight": 0
            },
            {
                "itemId": "1102**",
                "weight": 3
            },
            {
                "itemId": "1301**",
                "weight": 0
            },
            {
                "itemId": "1105022",
                "weight": 0
            },
            {
                "itemId": "1105033",
                "weight": 2
            },
            {
                "itemId": "1302*1",
                "weight": 2
            },
            {
                "itemId": "1106013",
                "weight": 0
            },
            {
                "itemId": "1101071",
                "weight": 5
            }
        ]
    },
    "13": {
        "produceValue": 124,
        "produceList": [
            {
                "itemId": "1101011",
                "weight": 20
            },
            {
                "itemId": "1101021",
                "weight": 10
            },
            {
                "itemId": "1101031",
                "weight": 10
            },
            {
                "itemId": "1101041",
                "weight": 5
            },
            {
                "itemId": "1101051",
                "weight": 1
            },
            {
                "itemId": "1101**",
                "weight": 10
            },
            {
                "itemId": "1102011",
                "weight": 1
            },
            {
                "itemId": "1103*1",
                "weight": 20
            },
            {
                "itemId": "1104011",
                "weight": 0
            },
            {
                "itemId": "1104021",
                "weight": 0
            },
            {
                "itemId": "1104043",
                "weight": 0
            },
            {
                "itemId": "1105011",
                "weight": 10
            },
            {
                "itemId": "1105042",
                "weight": 3
            },
            {
                "itemId": "1105**",
                "weight": 0
            },
            {
                "itemId": "1305011",
                "weight": 5
            },
            {
                "itemId": "1103083",
                "weight": 2
            },
            {
                "itemId": "1102**",
                "weight": 3
            },
            {
                "itemId": "1301**",
                "weight": 0
            },
            {
                "itemId": "1105022",
                "weight": 1
            },
            {
                "itemId": "1105033",
                "weight": 0
            },
            {
                "itemId": "1302*1",
                "weight": 1
            },
            {
                "itemId": "1106013",
                "weight": 0
            }
        ]
    },
    "14": {
        "produceValue": 314,
        "produceList": [
            {
                "itemId": "1101011",
                "weight": 50
            },
            {
                "itemId": "1101021",
                "weight": 20
            },
            {
                "itemId": "1101031",
                "weight": 5
            },
            {
                "itemId": "1101041",
                "weight": 6
            },
            {
                "itemId": "1101051",
                "weight": 1
            },
            {
                "itemId": "1101**",
                "weight": 10
            },
            {
                "itemId": "1102011",
                "weight": 2
            },
            {
                "itemId": "1103*1",
                "weight": 30
            },
            {
                "itemId": "1104011",
                "weight": 2
            },
            {
                "itemId": "1104021",
                "weight": 2
            },
            {
                "itemId": "1104043",
                "weight": 0
            },
            {
                "itemId": "1105011",
                "weight": 5
            },
            {
                "itemId": "1105042",
                "weight": 0
            },
            {
                "itemId": "1105**",
                "weight": 0
            },
            {
                "itemId": "1305011",
                "weight": 60
            },
            {
                "itemId": "1103083",
                "weight": 3
            },
            {
                "itemId": "1102**",
                "weight": 4
            },
            {
                "itemId": "1301**",
                "weight": 0
            },
            {
                "itemId": "1105022",
                "weight": 0
            },
            {
                "itemId": "1105033",
                "weight": 2
            },
            {
                "itemId": "1302*1",
                "weight": 2
            },
            {
                "itemId": "1106013",
                "weight": 0
            }
        ]
    },
    "20": {
        "produceValue": 87,
        "produceList": [
            {
                "itemId": "1101011",
                "weight": 15
            },
            {
                "itemId": "1101021",
                "weight": 5
            },
            {
                "itemId": "1101031",
                "weight": 0
            },
            {
                "itemId": "1101041",
                "weight": 15
            },
            {
                "itemId": "1101051",
                "weight": 10
            },
            {
                "itemId": "1101**",
                "weight": 10
            },
            {
                "itemId": "1102011",
                "weight": 0
            },
            {
                "itemId": "1103*1",
                "weight": 10
            },
            {
                "itemId": "1104011",
                "weight": 0
            },
            {
                "itemId": "1104021",
                "weight": 0
            },
            {
                "itemId": "1104043",
                "weight": 0
            },
            {
                "itemId": "1105011",
                "weight": 5
            },
            {
                "itemId": "1105042",
                "weight": 1
            },
            {
                "itemId": "1105**",
                "weight": 0
            },
            {
                "itemId": "1305011",
                "weight": 0
            },
            {
                "itemId": "1103083",
                "weight": 0
            },
            {
                "itemId": "1102**",
                "weight": 0
            },
            {
                "itemId": "1301**",
                "weight": 0
            },
            {
                "itemId": "1105022",
                "weight": 10
            },
            {
                "itemId": "1105033",
                "weight": 0
            },
            {
                "itemId": "1302*1",
                "weight": 0
            },
            {
                "itemId": "1106013",
                "weight": 0
            },
            {
                "itemId": "1101071",
                "weight": 5
            }
        ]
    },
    "21": {
        "produceValue": 117,
        "produceList": [
            {
                "itemId": "1101011",
                "weight": 50
            },
            {
                "itemId": "1101021",
                "weight": 15
            },
            {
                "itemId": "1101031",
                "weight": 10
            },
            {
                "itemId": "1101041",
                "weight": 10
            },
            {
                "itemId": "1101051",
                "weight": 15
            },
            {
                "itemId": "1101**",
                "weight": 30
            },
            {
                "itemId": "1102011",
                "weight": 1
            },
            {
                "itemId": "1103*1",
                "weight": 0
            },
            {
                "itemId": "1104011",
                "weight": 0
            },
            {
                "itemId": "1104021",
                "weight": 0
            },
            {
                "itemId": "1104043",
                "weight": 0
            },
            {
                "itemId": "1105011",
                "weight": 0
            },
            {
                "itemId": "1105042",
                "weight": 0
            },
            {
                "itemId": "1105**",
                "weight": 0
            },
            {
                "itemId": "1305011",
                "weight": 0
            },
            {
                "itemId": "1103083",
                "weight": 0
            },
            {
                "itemId": "1102**",
                "weight": 0
            },
            {
                "itemId": "1301**",
                "weight": 0
            },
            {
                "itemId": "1105022",
                "weight": 0
            },
            {
                "itemId": "1105033",
                "weight": 0
            },
            {
                "itemId": "1302*1",
                "weight": 1
            },
            {
                "itemId": "1106013",
                "weight": 0
            },
            {
                "itemId": "1101071",
                "weight": 15
            }
        ]
    },
    "22": {
        "produceValue": 184,
        "produceList": [
            {
                "itemId": "1101011",
                "weight": 75
            },
            {
                "itemId": "1101021",
                "weight": 50
            },
            {
                "itemId": "1101031",
                "weight": 15
            },
            {
                "itemId": "1101041",
                "weight": 20
            },
            {
                "itemId": "1101051",
                "weight": 10
            },
            {
                "itemId": "1101**",
                "weight": 10
            },
            {
                "itemId": "1102011",
                "weight": 0
            },
            {
                "itemId": "1103*1",
                "weight": 0
            },
            {
                "itemId": "1104011",
                "weight": 0
            },
            {
                "itemId": "1104021",
                "weight": 0
            },
            {
                "itemId": "1104043",
                "weight": 0
            },
            {
                "itemId": "1105011",
                "weight": 0
            },
            {
                "itemId": "1105042",
                "weight": 0
            },
            {
                "itemId": "1105**",
                "weight": 0
            },
            {
                "itemId": "1305011",
                "weight": 0
            },
            {
                "itemId": "1103083",
                "weight": 0
            },
            {
                "itemId": "1102**",
                "weight": 0
            },
            {
                "itemId": "1301**",
                "weight": 0
            },
            {
                "itemId": "1105022",
                "weight": 0
            },
            {
                "itemId": "1105033",
                "weight": 0
            },
            {
                "itemId": "1302*1",
                "weight": 5
            },
            {
                "itemId": "1106013",
                "weight": 0
            },
            {
                "itemId": "1101071",
                "weight": 25
            }
        ]
    },
    "30": {
        "produceValue": 86,
        "produceList": [
            {
                "itemId": "1101011",
                "weight": 50
            },
            {
                "itemId": "1101021",
                "weight": 10
            },
            {
                "itemId": "1101031",
                "weight": 5
            },
            {
                "itemId": "1101041",
                "weight": 6
            },
            {
                "itemId": "1101051",
                "weight": 0
            },
            {
                "itemId": "1101**",
                "weight": 10
            },
            {
                "itemId": "1102011",
                "weight": 0
            },
            {
                "itemId": "1103*1",
                "weight": 0
            },
            {
                "itemId": "1104011",
                "weight": 0
            },
            {
                "itemId": "1104021",
                "weight": 0
            },
            {
                "itemId": "1104043",
                "weight": 0
            },
            {
                "itemId": "1105011",
                "weight": 0
            },
            {
                "itemId": "1105042",
                "weight": 0
            },
            {
                "itemId": "1105**",
                "weight": 0
            },
            {
                "itemId": "1305011",
                "weight": 0
            },
            {
                "itemId": "1103083",
                "weight": 0
            },
            {
                "itemId": "1102**",
                "weight": 0
            },
            {
                "itemId": "1301**",
                "weight": 0
            },
            {
                "itemId": "1105022",
                "weight": 0
            },
            {
                "itemId": "1105033",
                "weight": 0
            },
            {
                "itemId": "1302*1",
                "weight": 2
            },
            {
                "itemId": "1106013",
                "weight": 0
            }
        ]
    },
    "31": {
        "produceValue": 52,
        "produceList": [
            {
                "itemId": "1101011",
                "weight": 10
            },
            {
                "itemId": "1101021",
                "weight": 10
            },
            {
                "itemId": "1101031",
                "weight": 20
            },
            {
                "itemId": "1101041",
                "weight": 3
            },
            {
                "itemId": "1101051",
                "weight": 0
            },
            {
                "itemId": "1101**",
                "weight": 10
            },
            {
                "itemId": "1102011",
                "weight": 0
            },
            {
                "itemId": "1103*1",
                "weight": 0
            },
            {
                "itemId": "1104011",
                "weight": 0
            },
            {
                "itemId": "1104021",
                "weight": 0
            },
            {
                "itemId": "1104043",
                "weight": 0
            },
            {
                "itemId": "1105011",
                "weight": 0
            },
            {
                "itemId": "1105042",
                "weight": 0
            },
            {
                "itemId": "1105**",
                "weight": 0
            },
            {
                "itemId": "1305011",
                "weight": 0
            },
            {
                "itemId": "1103083",
                "weight": 0
            },
            {
                "itemId": "1102**",
                "weight": 0
            },
            {
                "itemId": "1301**",
                "weight": 0
            },
            {
                "itemId": "1105022",
                "weight": 0
            },
            {
                "itemId": "1105033",
                "weight": 0
            },
            {
                "itemId": "1302*1",
                "weight": 0
            },
            {
                "itemId": "1106013",
                "weight": 0
            }
        ]
    },
    "32": {
        "produceValue": 158,
        "produceList": [
            {
                "itemId": "1101011",
                "weight": 25
            },
            {
                "itemId": "1101021",
                "weight": 20
            },
            {
                "itemId": "1101031",
                "weight": 10
            },
            {
                "itemId": "1101041",
                "weight": 10
            },
            {
                "itemId": "1101051",
                "weight": 20
            },
            {
                "itemId": "1101**",
                "weight": 10
            },
            {
                "itemId": "1102011",
                "weight": 1
            },
            {
                "itemId": "1103*1",
                "weight": 0
            },
            {
                "itemId": "1104011",
                "weight": 0
            },
            {
                "itemId": "1104021",
                "weight": 0
            },
            {
                "itemId": "1104043",
                "weight": 0
            },
            {
                "itemId": "1105011",
                "weight": 0
            },
            {
                "itemId": "1105042",
                "weight": 0
            },
            {
                "itemId": "1105**",
                "weight": 0
            },
            {
                "itemId": "1305011",
                "weight": 50
            },
            {
                "itemId": "1103083",
                "weight": 2
            },
            {
                "itemId": "1102**",
                "weight": 3
            },
            {
                "itemId": "1301**",
                "weight": 0
            },
            {
                "itemId": "1105022",
                "weight": 0
            },
            {
                "itemId": "1105033",
                "weight": 0
            },
            {
                "itemId": "1302*1",
                "weight": 5
            },
            {
                "itemId": "1106013",
                "weight": 0
            },
            {
                "itemId": "1101071",
                "weight": 5
            }
        ]
    },
    "33": {
        "produceValue": 1018,
        "produceList": [
            {
                "itemId": "1101011",
                "weight": 150
            },
            {
                "itemId": "1101021",
                "weight": 30
            },
            {
                "itemId": "1101031",
                "weight": 20
            },
            {
                "itemId": "1101041",
                "weight": 40
            },
            {
                "itemId": "1101051",
                "weight": 50
            },
            {
                "itemId": "1101**",
                "weight": 10
            },
            {
                "itemId": "1102011",
                "weight": 2
            },
            {
                "itemId": "1103*1",
                "weight": 50
            },
            {
                "itemId": "1104011",
                "weight": 10
            },
            {
                "itemId": "1104021",
                "weight": 10
            },
            {
                "itemId": "1104043",
                "weight": 0
            },
            {
                "itemId": "1105011",
                "weight": 30
            },
            {
                "itemId": "1105042",
                "weight": 10
            },
            {
                "itemId": "1105**",
                "weight": 0
            },
            {
                "itemId": "1305011",
                "weight": 300
            },
            {
                "itemId": "1103083",
                "weight": 15
            },
            {
                "itemId": "1102**",
                "weight": 6
            },
            {
                "itemId": "1301**",
                "weight": 0
            },
            {
                "itemId": "1105022",
                "weight": 10
            },
            {
                "itemId": "1105033",
                "weight": 5
            },
            {
                "itemId": "1302*1",
                "weight": 5
            },
            {
                "itemId": "1106013",
                "weight": 0
            },
            {
                "itemId": "1101071",
                "weight": 25
            }
        ]
    },
    "41": {
        "produceValue": 97,
        "produceList": [
            {
                "itemId": "1101011",
                "weight": 20
            },
            {
                "itemId": "1101021",
                "weight": 15
            },
            {
                "itemId": "1101031",
                "weight": 0
            },
            {
                "itemId": "1101041",
                "weight": 15
            },
            {
                "itemId": "1101051",
                "weight": 5
            },
            {
                "itemId": "1101**",
                "weight": 20
            },
            {
                "itemId": "1102011",
                "weight": 0
            },
            {
                "itemId": "1103*1",
                "weight": 0
            },
            {
                "itemId": "1104011",
                "weight": 0
            },
            {
                "itemId": "1104021",
                "weight": 0
            },
            {
                "itemId": "1104043",
                "weight": 0
            },
            {
                "itemId": "1105011",
                "weight": 0
            },
            {
                "itemId": "1105042",
                "weight": 0
            },
            {
                "itemId": "1105**",
                "weight": 0
            },
            {
                "itemId": "1305011",
                "weight": 0
            },
            {
                "itemId": "1103083",
                "weight": 0
            },
            {
                "itemId": "1102**",
                "weight": 0
            },
            {
                "itemId": "1301**",
                "weight": 0
            },
            {
                "itemId": "1105022",
                "weight": 0
            },
            {
                "itemId": "1105033",
                "weight": 0
            },
            {
                "itemId": "1302*1",
                "weight": 10
            },
            {
                "itemId": "1106013",
                "weight": 0
            }
        ]
    },
    "42": {
        "produceValue": 44,
        "produceList": [
            {
                "itemId": "1101011",
                "weight": 10
            },
            {
                "itemId": "1101021",
                "weight": 10
            },
            {
                "itemId": "1101031",
                "weight": 0
            },
            {
                "itemId": "1101041",
                "weight": 10
            },
            {
                "itemId": "1101051",
                "weight": 30
            },
            {
                "itemId": "1101**",
                "weight": 10
            },
            {
                "itemId": "1102011",
                "weight": 0
            },
            {
                "itemId": "1103*1",
                "weight": 0
            },
            {
                "itemId": "1104011",
                "weight": 0
            },
            {
                "itemId": "1104021",
                "weight": 0
            },
            {
                "itemId": "1104043",
                "weight": 0
            },
            {
                "itemId": "1105011",
                "weight": 0
            },
            {
                "itemId": "1105042",
                "weight": 0
            },
            {
                "itemId": "1105**",
                "weight": 0
            },
            {
                "itemId": "1305011",
                "weight": 0
            },
            {
                "itemId": "1103083",
                "weight": 0
            },
            {
                "itemId": "1102**",
                "weight": 0
            },
            {
                "itemId": "1301**",
                "weight": 0
            },
            {
                "itemId": "1105022",
                "weight": 0
            },
            {
                "itemId": "1105033",
                "weight": 0
            },
            {
                "itemId": "1302*1",
                "weight": 0
            },
            {
                "itemId": "1106013",
                "weight": 0
            }
        ]
    },
    "43": {
        "produceValue": 90,
        "produceList": [
            {
                "itemId": "1101011",
                "weight": 30
            },
            {
                "itemId": "1101021",
                "weight": 10
            },
            {
                "itemId": "1101031",
                "weight": 10
            },
            {
                "itemId": "1101041",
                "weight": 10
            },
            {
                "itemId": "1101051",
                "weight": 5
            },
            {
                "itemId": "1101**",
                "weight": 10
            },
            {
                "itemId": "1102011",
                "weight": 0
            },
            {
                "itemId": "1103*1",
                "weight": 0
            },
            {
                "itemId": "1104011",
                "weight": 0
            },
            {
                "itemId": "1104021",
                "weight": 0
            },
            {
                "itemId": "1104043",
                "weight": 0
            },
            {
                "itemId": "1105011",
                "weight": 10
            },
            {
                "itemId": "1105042",
                "weight": 0
            },
            {
                "itemId": "1105**",
                "weight": 0
            },
            {
                "itemId": "1305011",
                "weight": 0
            },
            {
                "itemId": "1103083",
                "weight": 0
            },
            {
                "itemId": "1102**",
                "weight": 0
            },
            {
                "itemId": "1301**",
                "weight": 0
            },
            {
                "itemId": "1105022",
                "weight": 0
            },
            {
                "itemId": "1105033",
                "weight": 0
            },
            {
                "itemId": "1302*1",
                "weight": 0
            },
            {
                "itemId": "1106013",
                "weight": 0
            }
        ]
    },
    "51": {
        "produceValue": 683,
        "produceList": [
            {
                "itemId": "1101011",
                "weight": 20
            },
            {
                "itemId": "1101021",
                "weight": 3
            },
            {
                "itemId": "1101031",
                "weight": 5
            },
            {
                "itemId": "1101041",
                "weight": 5
            },
            {
                "itemId": "1101051",
                "weight": 5
            },
            {
                "itemId": "1101**",
                "weight": 10
            },
            {
                "itemId": "1102011",
                "weight": 1
            },
            {
                "itemId": "1103*1",
                "weight": 0
            },
            {
                "itemId": "1104011",
                "weight": 10
            },
            {
                "itemId": "1104021",
                "weight": 5
            },
            {
                "itemId": "1104043",
                "weight": 4
            },
            {
                "itemId": "1105011",
                "weight": 0
            },
            {
                "itemId": "1105042",
                "weight": 0
            },
            {
                "itemId": "1105**",
                "weight": 0
            },
            {
                "itemId": "1305011",
                "weight": 0
            },
            {
                "itemId": "1103083",
                "weight": 0
            },
            {
                "itemId": "1102**",
                "weight": 0
            },
            {
                "itemId": "1301**",
                "weight": 0
            },
            {
                "itemId": "1105022",
                "weight": 0
            },
            {
                "itemId": "1105033",
                "weight": 10
            },
            {
                "itemId": "1302*1",
                "weight": 0
            },
            {
                "itemId": "1106013",
                "weight": 0
            }
        ]
    },
    "52": {
        "produceValue": 106,
        "produceList": [
            {
                "itemId": "1101011",
                "weight": 20
            },
            {
                "itemId": "1101021",
                "weight": 5
            },
            {
                "itemId": "1101031",
                "weight": 0
            },
            {
                "itemId": "1101041",
                "weight": 5
            },
            {
                "itemId": "1101051",
                "weight": 1
            },
            {
                "itemId": "1101**",
                "weight": 10
            },
            {
                "itemId": "1102011",
                "weight": 1
            },
            {
                "itemId": "1103*1",
                "weight": 5
            },
            {
                "itemId": "1104011",
                "weight": 0
            },
            {
                "itemId": "1104021",
                "weight": 0
            },
            {
                "itemId": "1104043",
                "weight": 0
            },
            {
                "itemId": "1105011",
                "weight": 5
            },
            {
                "itemId": "1105042",
                "weight": 0
            },
            {
                "itemId": "1105**",
                "weight": 0
            },
            {
                "itemId": "1305011",
                "weight": 30
            },
            {
                "itemId": "1103083",
                "weight": 2
            },
            {
                "itemId": "1102**",
                "weight": 3
            },
            {
                "itemId": "1301**",
                "weight": 0
            },
            {
                "itemId": "1105022",
                "weight": 0
            },
            {
                "itemId": "1105033",
                "weight": 0
            },
            {
                "itemId": "1302*1",
                "weight": 2
            },
            {
                "itemId": "1106013",
                "weight": 0
            }
        ]
    },
    "203": {
        "produceValue": 600,
        "produceList": [
            {
                "itemId": "1101*1",
                "weight": 5
            },
            {
                "itemId": "1101071",
                "weight": 95
            }
        ]
    },
    "301": {
        "produceValue": 68,
        "produceList": [
            {
                "itemId": "1101011",
                "weight": 10
            },
            {
                "itemId": "1101021",
                "weight": 10
            },
            {
                "itemId": "1101031",
                "weight": 10
            },
            {
                "itemId": "1101041",
                "weight": 10
            },
            {
                "itemId": "1101051",
                "weight": 10
            },
            {
                "itemId": "1101061",
                "weight": 10
            },
            {
                "itemId": "1102011",
                "weight": 5
            },
            {
                "itemId": "1102022",
                "weight": 5
            },
            {
                "itemId": "1102033",
                "weight": 5
            },
            {
                "itemId": "1102042",
                "weight": 10
            },
            {
                "itemId": "1103011",
                "weight": 10
            },
            {
                "itemId": "1103041",
                "weight": 10
            },
            {
                "itemId": "1103083",
                "weight": 20
            },
            {
                "itemId": "1104011",
                "weight": 20
            },
            {
                "itemId": "1104021",
                "weight": 20
            },
            {
                "itemId": "1105011",
                "weight": 10
            },
            {
                "itemId": "1105022",
                "weight": 10
            },
            {
                "itemId": "1302011",
                "weight": 5
            },
            {
                "itemId": "1305011",
                "weight": 5
            },
            {
                "itemId": "1101073",
                "weight": 5
            },
            {
                "itemId": "1101071",
                "weight": 5
            }
        ]
    },
    "302": {
        "produceValue": 98,
        "produceList": [
            {
                "itemId": "1101011",
                "weight": 10
            },
            {
                "itemId": "1101021",
                "weight": 10
            },
            {
                "itemId": "1101031",
                "weight": 10
            },
            {
                "itemId": "1101041",
                "weight": 10
            },
            {
                "itemId": "1101051",
                "weight": 10
            },
            {
                "itemId": "1101061",
                "weight": 10
            },
            {
                "itemId": "1102011",
                "weight": 5
            },
            {
                "itemId": "1102022",
                "weight": 5
            },
            {
                "itemId": "1102033",
                "weight": 5
            },
            {
                "itemId": "1102042",
                "weight": 10
            },
            {
                "itemId": "1103011",
                "weight": 10
            },
            {
                "itemId": "1103041",
                "weight": 10
            },
            {
                "itemId": "1103083",
                "weight": 20
            },
            {
                "itemId": "1104011",
                "weight": 20
            },
            {
                "itemId": "1104021",
                "weight": 20
            },
            {
                "itemId": "1105011",
                "weight": 10
            },
            {
                "itemId": "1105022",
                "weight": 10
            },
            {
                "itemId": "1302011",
                "weight": 5
            },
            {
                "itemId": "1305011",
                "weight": 5
            },
            {
                "itemId": "1101073",
                "weight": 5
            }
        ]
    },
    "303": {
        "produceValue": 98,
        "produceList": [
            {
                "itemId": "1101011",
                "weight": 10
            },
            {
                "itemId": "1101021",
                "weight": 10
            },
            {
                "itemId": "1101031",
                "weight": 10
            },
            {
                "itemId": "1101041",
                "weight": 10
            },
            {
                "itemId": "1101051",
                "weight": 10
            },
            {
                "itemId": "1101061",
                "weight": 10
            },
            {
                "itemId": "1102011",
                "weight": 5
            },
            {
                "itemId": "1102022",
                "weight": 5
            },
            {
                "itemId": "1102033",
                "weight": 5
            },
            {
                "itemId": "1102042",
                "weight": 10
            },
            {
                "itemId": "1103011",
                "weight": 10
            },
            {
                "itemId": "1103041",
                "weight": 10
            },
            {
                "itemId": "1103083",
                "weight": 20
            },
            {
                "itemId": "1104011",
                "weight": 20
            },
            {
                "itemId": "1104021",
                "weight": 20
            },
            {
                "itemId": "1105011",
                "weight": 10
            },
            {
                "itemId": "1105022",
                "weight": 10
            },
            {
                "itemId": "1302011",
                "weight": 5
            },
            {
                "itemId": "1305011",
                "weight": 5
            },
            {
                "itemId": "1101073",
                "weight": 5
            }
        ]
    },
    "304": {
        "produceValue": 98,
        "produceList": [
            {
                "itemId": "1101011",
                "weight": 10
            },
            {
                "itemId": "1101021",
                "weight": 10
            },
            {
                "itemId": "1101031",
                "weight": 10
            },
            {
                "itemId": "1101041",
                "weight": 10
            },
            {
                "itemId": "1101051",
                "weight": 10
            },
            {
                "itemId": "1101061",
                "weight": 10
            },
            {
                "itemId": "1102011",
                "weight": 5
            },
            {
                "itemId": "1102022",
                "weight": 5
            },
            {
                "itemId": "1102033",
                "weight": 5
            },
            {
                "itemId": "1102042",
                "weight": 10
            },
            {
                "itemId": "1103011",
                "weight": 10
            },
            {
                "itemId": "1103041",
                "weight": 10
            },
            {
                "itemId": "1103083",
                "weight": 20
            },
            {
                "itemId": "1104011",
                "weight": 20
            },
            {
                "itemId": "1104021",
                "weight": 20
            },
            {
                "itemId": "1105011",
                "weight": 10
            },
            {
                "itemId": "1105022",
                "weight": 10
            },
            {
                "itemId": "1302011",
                "weight": 5
            },
            {
                "itemId": "1305011",
                "weight": 5
            },
            {
                "itemId": "1101073",
                "weight": 5
            },
            {
                "itemId": "1101071",
                "weight": 5
            }
        ]
    },
    "305": {
        "produceValue": 98,
        "produceList": [
            {
                "itemId": "1101011",
                "weight": 10
            },
            {
                "itemId": "1101021",
                "weight": 10
            },
            {
                "itemId": "1101031",
                "weight": 10
            },
            {
                "itemId": "1101041",
                "weight": 10
            },
            {
                "itemId": "1101051",
                "weight": 10
            },
            {
                "itemId": "1101061",
                "weight": 10
            },
            {
                "itemId": "1102011",
                "weight": 5
            },
            {
                "itemId": "1102022",
                "weight": 5
            },
            {
                "itemId": "1102033",
                "weight": 5
            },
            {
                "itemId": "1102042",
                "weight": 10
            },
            {
                "itemId": "1103011",
                "weight": 10
            },
            {
                "itemId": "1103041",
                "weight": 10
            },
            {
                "itemId": "1103083",
                "weight": 20
            },
            {
                "itemId": "1104011",
                "weight": 20
            },
            {
                "itemId": "1104021",
                "weight": 20
            },
            {
                "itemId": "1105011",
                "weight": 10
            },
            {
                "itemId": "1105022",
                "weight": 10
            },
            {
                "itemId": "1302011",
                "weight": 5
            },
            {
                "itemId": "1305011",
                "weight": 5
            },
            {
                "itemId": "1101073",
                "weight": 5
            }
        ]
    },
    "306": {
        "produceValue": 98,
        "produceList": [
            {
                "itemId": "1101011",
                "weight": 10
            },
            {
                "itemId": "1101021",
                "weight": 10
            },
            {
                "itemId": "1101031",
                "weight": 10
            },
            {
                "itemId": "1101041",
                "weight": 10
            },
            {
                "itemId": "1101051",
                "weight": 10
            },
            {
                "itemId": "1101061",
                "weight": 10
            },
            {
                "itemId": "1102011",
                "weight": 5
            },
            {
                "itemId": "1102022",
                "weight": 5
            },
            {
                "itemId": "1102033",
                "weight": 5
            },
            {
                "itemId": "1102042",
                "weight": 10
            },
            {
                "itemId": "1103011",
                "weight": 10
            },
            {
                "itemId": "1103041",
                "weight": 10
            },
            {
                "itemId": "1103083",
                "weight": 20
            },
            {
                "itemId": "1104011",
                "weight": 20
            },
            {
                "itemId": "1104021",
                "weight": 20
            },
            {
                "itemId": "1105011",
                "weight": 10
            },
            {
                "itemId": "1105022",
                "weight": 10
            },
            {
                "itemId": "1302011",
                "weight": 5
            },
            {
                "itemId": "1305011",
                "weight": 5
            },
            {
                "itemId": "1101073",
                "weight": 5
            }
        ]
    },
    "307": {
        "produceValue": 98,
        "produceList": [
            {
                "itemId": "1101011",
                "weight": 10
            },
            {
                "itemId": "1101021",
                "weight": 10
            },
            {
                "itemId": "1101031",
                "weight": 10
            },
            {
                "itemId": "1101041",
                "weight": 10
            },
            {
                "itemId": "1101051",
                "weight": 10
            },
            {
                "itemId": "1101061",
                "weight": 10
            },
            {
                "itemId": "1102011",
                "weight": 5
            },
            {
                "itemId": "1102022",
                "weight": 5
            },
            {
                "itemId": "1102033",
                "weight": 5
            },
            {
                "itemId": "1102042",
                "weight": 10
            },
            {
                "itemId": "1103011",
                "weight": 10
            },
            {
                "itemId": "1103041",
                "weight": 10
            },
            {
                "itemId": "1103083",
                "weight": 20
            },
            {
                "itemId": "1104011",
                "weight": 20
            },
            {
                "itemId": "1104021",
                "weight": 20
            },
            {
                "itemId": "1105011",
                "weight": 10
            },
            {
                "itemId": "1105022",
                "weight": 10
            },
            {
                "itemId": "1302011",
                "weight": 5
            },
            {
                "itemId": "1305011",
                "weight": 5
            },
            {
                "itemId": "1101073",
                "weight": 5
            }
        ]
    },
    "308": {
        "produceValue": 98,
        "produceList": [
            {
                "itemId": "1101011",
                "weight": 10
            },
            {
                "itemId": "1101021",
                "weight": 10
            },
            {
                "itemId": "1101031",
                "weight": 10
            },
            {
                "itemId": "1101041",
                "weight": 10
            },
            {
                "itemId": "1101051",
                "weight": 10
            },
            {
                "itemId": "1101061",
                "weight": 10
            },
            {
                "itemId": "1102011",
                "weight": 5
            },
            {
                "itemId": "1102022",
                "weight": 5
            },
            {
                "itemId": "1102033",
                "weight": 5
            },
            {
                "itemId": "1102042",
                "weight": 10
            },
            {
                "itemId": "1103011",
                "weight": 10
            },
            {
                "itemId": "1103041",
                "weight": 10
            },
            {
                "itemId": "1103083",
                "weight": 20
            },
            {
                "itemId": "1104011",
                "weight": 20
            },
            {
                "itemId": "1104021",
                "weight": 20
            },
            {
                "itemId": "1105011",
                "weight": 10
            },
            {
                "itemId": "1105022",
                "weight": 10
            },
            {
                "itemId": "1302011",
                "weight": 5
            },
            {
                "itemId": "1305011",
                "weight": 5
            },
            {
                "itemId": "1101073",
                "weight": 5
            }
        ]
    },
    "309": {
        "produceValue": 98,
        "produceList": [
            {
                "itemId": "1101011",
                "weight": 10
            },
            {
                "itemId": "1101021",
                "weight": 10
            },
            {
                "itemId": "1101031",
                "weight": 10
            },
            {
                "itemId": "1101041",
                "weight": 10
            },
            {
                "itemId": "1101051",
                "weight": 10
            },
            {
                "itemId": "1101061",
                "weight": 10
            },
            {
                "itemId": "1102011",
                "weight": 5
            },
            {
                "itemId": "1102022",
                "weight": 5
            },
            {
                "itemId": "1102033",
                "weight": 5
            },
            {
                "itemId": "1102042",
                "weight": 10
            },
            {
                "itemId": "1103011",
                "weight": 10
            },
            {
                "itemId": "1103041",
                "weight": 10
            },
            {
                "itemId": "1103083",
                "weight": 20
            },
            {
                "itemId": "1104011",
                "weight": 20
            },
            {
                "itemId": "1104021",
                "weight": 20
            },
            {
                "itemId": "1105011",
                "weight": 10
            },
            {
                "itemId": "1105022",
                "weight": 10
            },
            {
                "itemId": "1302011",
                "weight": 5
            },
            {
                "itemId": "1305011",
                "weight": 5
            },
            {
                "itemId": "1101073",
                "weight": 5
            }
        ]
    },
    "310": {
        "produceValue": 118,
        "produceList": [
            {
                "itemId": "1101011",
                "weight": 10
            },
            {
                "itemId": "1101021",
                "weight": 10
            },
            {
                "itemId": "1101031",
                "weight": 10
            },
            {
                "itemId": "1101041",
                "weight": 10
            },
            {
                "itemId": "1101051",
                "weight": 10
            },
            {
                "itemId": "1101061",
                "weight": 10
            },
            {
                "itemId": "1102011",
                "weight": 5
            },
            {
                "itemId": "1102022",
                "weight": 5
            },
            {
                "itemId": "1102033",
                "weight": 5
            },
            {
                "itemId": "1102042",
                "weight": 10
            },
            {
                "itemId": "1103011",
                "weight": 10
            },
            {
                "itemId": "1103041",
                "weight": 10
            },
            {
                "itemId": "1103083",
                "weight": 20
            },
            {
                "itemId": "1104011",
                "weight": 20
            },
            {
                "itemId": "1104021",
                "weight": 20
            },
            {
                "itemId": "1105011",
                "weight": 10
            },
            {
                "itemId": "1105022",
                "weight": 10
            },
            {
                "itemId": "1302011",
                "weight": 5
            },
            {
                "itemId": "1305011",
                "weight": 5
            },
            {
                "itemId": "1101073",
                "weight": 5
            },
            {
                "itemId": "1101071",
                "weight": 15
            }
        ]
    },
    "311": {
        "produceValue": 118,
        "produceList": [
            {
                "itemId": "1101011",
                "weight": 10
            },
            {
                "itemId": "1101021",
                "weight": 10
            },
            {
                "itemId": "1101031",
                "weight": 10
            },
            {
                "itemId": "1101041",
                "weight": 10
            },
            {
                "itemId": "1101051",
                "weight": 10
            },
            {
                "itemId": "1101061",
                "weight": 10
            },
            {
                "itemId": "1102011",
                "weight": 5
            },
            {
                "itemId": "1102022",
                "weight": 5
            },
            {
                "itemId": "1102033",
                "weight": 5
            },
            {
                "itemId": "1102042",
                "weight": 10
            },
            {
                "itemId": "1103011",
                "weight": 10
            },
            {
                "itemId": "1103041",
                "weight": 10
            },
            {
                "itemId": "1103083",
                "weight": 20
            },
            {
                "itemId": "1104011",
                "weight": 20
            },
            {
                "itemId": "1104021",
                "weight": 20
            },
            {
                "itemId": "1105011",
                "weight": 10
            },
            {
                "itemId": "1105022",
                "weight": 10
            },
            {
                "itemId": "1302011",
                "weight": 5
            },
            {
                "itemId": "1305011",
                "weight": 5
            },
            {
                "itemId": "1101073",
                "weight": 5
            }
        ]
    },
    "312": {
        "produceValue": 150,
        "produceList": [
            {
                "itemId": "1101011",
                "weight": 10
            },
            {
                "itemId": "1101021",
                "weight": 10
            },
            {
                "itemId": "1101031",
                "weight": 10
            },
            {
                "itemId": "1101041",
                "weight": 10
            },
            {
                "itemId": "1101051",
                "weight": 10
            },
            {
                "itemId": "1101061",
                "weight": 10
            },
            {
                "itemId": "1102011",
                "weight": 5
            },
            {
                "itemId": "1102022",
                "weight": 5
            },
            {
                "itemId": "1102033",
                "weight": 5
            },
            {
                "itemId": "1102042",
                "weight": 10
            },
            {
                "itemId": "1103011",
                "weight": 10
            },
            {
                "itemId": "1103041",
                "weight": 10
            },
            {
                "itemId": "1103083",
                "weight": 20
            },
            {
                "itemId": "1104011",
                "weight": 20
            },
            {
                "itemId": "1104021",
                "weight": 20
            },
            {
                "itemId": "1105011",
                "weight": 10
            },
            {
                "itemId": "1105022",
                "weight": 10
            },
            {
                "itemId": "1302011",
                "weight": 5
            },
            {
                "itemId": "1305011",
                "weight": 5
            },
            {
                "itemId": "1101073",
                "weight": 5
            }
        ]
    }
} as const satisfies Record<number, SiteProduceConfig>;

export function getSiteProduceConfig (siteId: number): SiteProduceConfig | undefined
{
    return (SITE_PRODUCE_CONFIG as Record<number, SiteProduceConfig>)[siteId];
}
